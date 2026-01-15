import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/prompts/[id] - Get a single prompt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: prompt, error } = await supabase
    .from('prompts')
    .select(`
      *,
      flow:flows(id, name, description)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(prompt, { headers: corsHeaders });
}

// PUT/PATCH /api/prompts/[id] - Update a prompt
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updatePrompt(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updatePrompt(request, params);
}

async function updatePrompt(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  const { id } = await params;
  const supabase = createServiceClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { prompt: updates } = body;

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {};

  const allowedFields = [
    'type',
    'action',
    'endpoint_type',
    'selected_provider',
    'selected_model',
    'system_prompt',
    'tools',
    'background_prompt',
    'foreground_prompt',
    'negative_prompt',
    'preserve_original_subject',
    'original_background_depth',
    'keep_original_background',
    'light_source_direction',
    'light_source_strength',
    'seed',
    'output_format',
    'size',
    'quality',
    'subject_image_url',
    'background_reference_url',
    'attachment_urls',
    'position',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  const { data: prompt, error } = await supabase
    .from('prompts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(prompt, { headers: corsHeaders });
}

// DELETE /api/prompts/[id] - Delete a prompt
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from('prompts').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
