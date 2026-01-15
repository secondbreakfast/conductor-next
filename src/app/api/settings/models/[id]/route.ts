import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

const VALID_ENDPOINT_TYPES = [
  'Chat',
  'ImageToImage',
  'ImageToVideo',
  'VideoToVideo',
  'AudioToText',
  'TextToAudio',
];

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: model, error } = await supabase
    .from('models')
    .select(`
      *,
      provider:providers(id, name, slug)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === 'PGRST116' ? 'Model not found' : error.message },
      { status: error.code === 'PGRST116' ? 404 : 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(model, { headers: corsHeaders });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('models')
    .select('id, provider_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: 'Model not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { model: updates } = body;
  const allowedFields = [
    'name',
    'model_id',
    'endpoint_types',
    'enabled',
    'display_order',
    'default_params',
    'input_price',
    'output_price',
  ];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'endpoint_types') {
        if (!Array.isArray(updates.endpoint_types) || updates.endpoint_types.length === 0) {
          return NextResponse.json(
            { error: 'At least one endpoint type is required' },
            { status: 400, headers: corsHeaders }
          );
        }
        const invalidTypes = updates.endpoint_types.filter(
          (t: string) => !VALID_ENDPOINT_TYPES.includes(t)
        );
        if (invalidTypes.length > 0) {
          return NextResponse.json(
            { error: `Invalid endpoint types: ${invalidTypes.join(', ')}` },
            { status: 400, headers: corsHeaders }
          );
        }
      }

      if (field === 'model_id') {
        const { data: duplicateModel } = await supabase
          .from('models')
          .select('id')
          .eq('provider_id', existing.provider_id)
          .eq('model_id', updates.model_id)
          .neq('id', id)
          .single();

        if (duplicateModel) {
          return NextResponse.json(
            { error: 'A model with this ID already exists for this provider' },
            { status: 400, headers: corsHeaders }
          );
        }
      }

      updateData[field] = updates[field];
    }
  }

  const { data: model, error } = await supabase
    .from('models')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      provider:providers(id, name, slug)
    `)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(model, { headers: corsHeaders });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('models')
    .select('id, model_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: 'Model not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  const { count: promptsAffected } = await supabase
    .from('prompts')
    .select('id', { count: 'exact', head: true })
    .eq('selected_model', existing.model_id);

  const { error } = await supabase.from('models').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    { success: true, prompts_affected: promptsAffected || 0 },
    { headers: corsHeaders }
  );
}
