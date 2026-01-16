import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: provider, error } = await supabase
    .from('providers')
    .select(`
      *,
      models(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === 'PGRST116' ? 'Provider not found' : error.message },
      { status: error.code === 'PGRST116' ? 404 : 500, headers: corsHeaders }
    );
  }

  if (provider.models) {
    (provider.models as Array<{ display_order: number }>).sort(
      (a, b) => a.display_order - b.display_order
    );
  }

  return NextResponse.json(provider, { headers: corsHeaders });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('providers')
    .select('id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: 'Provider not found' },
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

  const { provider: updates } = body;
  const allowedFields = ['name', 'slug', 'enabled', 'display_order'];
  const updateData: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      if (field === 'slug') {
        const newSlug = updates.slug.toLowerCase();
        const { data: slugExists } = await supabase
          .from('providers')
          .select('id')
          .eq('slug', newSlug)
          .neq('id', id)
          .single();

        if (slugExists) {
          return NextResponse.json(
            { error: 'A provider with this slug already exists' },
            { status: 400, headers: corsHeaders }
          );
        }
        updateData.slug = newSlug;
      } else {
        updateData[field] = updates[field];
      }
    }
  }

  const { data: provider, error } = await supabase
    .from('providers')
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

  return NextResponse.json(provider, { headers: corsHeaders });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('providers')
    .select('id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: 'Provider not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  const { error } = await supabase.from('providers').delete().eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
