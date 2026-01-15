import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveFlowByIdentifier, validateSlug } from '@/lib/slug';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/flows/[id] - Get a single flow with its prompts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const resolved = await resolveFlowByIdentifier(supabase, id);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Flow not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  const { data: flow, error } = await supabase
    .from('flows')
    .select(`
      *,
      prompts(*)
    `)
    .eq('id', resolved.id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 500, headers: corsHeaders }
    );
  }

  // Sort prompts by position
  if (flow.prompts) {
    (flow.prompts as Array<{ position?: number }>).sort(
      (a, b) => (a.position || 0) - (b.position || 0)
    );
  }

  return NextResponse.json(flow, { headers: corsHeaders });
}

// PUT/PATCH /api/flows/[id] - Update a flow
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateFlow(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateFlow(request, params);
}

async function updateFlow(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const resolved = await resolveFlowByIdentifier(supabase, id);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Flow not found' },
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

  const { flow: updates } = body;

  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.description !== undefined) {
    updateData.description = updates.description;
  }

  if (updates.slug !== undefined) {
    if (updates.slug === null || updates.slug === '') {
      updateData.slug = null;
    } else {
      const validation = validateSlug(updates.slug);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400, headers: corsHeaders }
        );
      }
      const { data: existing } = await supabase
        .from('flows')
        .select('id')
        .eq('slug', updates.slug.toLowerCase())
        .neq('id', resolved.id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A flow with this slug already exists' },
          { status: 400, headers: corsHeaders }
        );
      }
      updateData.slug = updates.slug.toLowerCase();
    }
  }

  const { data: flow, error } = await supabase
    .from('flows')
    .update(updateData)
    .eq('id', resolved.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(flow, { headers: corsHeaders });
}

// DELETE /api/flows/[id] - Delete a flow
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const resolved = await resolveFlowByIdentifier(supabase, id);
  if (!resolved) {
    return NextResponse.json(
      { error: 'Flow not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  const { error } = await supabase.from('flows').delete().eq('id', resolved.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
