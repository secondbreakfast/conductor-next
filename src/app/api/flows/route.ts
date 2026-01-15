import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateSlug } from '@/lib/slug';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/flows - List all flows
export async function GET() {
  const supabase = createServiceClient();

  const { data: flows, error } = await supabase
    .from('flows')
    .select(`
      *,
      prompts(count),
      runs(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  // Transform to add counts
  const transformedFlows = flows.map((flow) => ({
    ...flow,
    prompts_count: Array.isArray(flow.prompts) ? flow.prompts.length : (flow.prompts as { count: number })?.count || 0,
    runs_count: Array.isArray(flow.runs) ? flow.runs.length : (flow.runs as { count: number })?.count || 0,
  }));

  return NextResponse.json(transformedFlows, { headers: corsHeaders });
}

// POST /api/flows - Create a new flow
export async function POST(request: NextRequest) {
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

  const { flow } = body;

  if (!flow?.name) {
    return NextResponse.json(
      { error: 'Flow name is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  let slug: string | null = null;
  if (flow.slug !== undefined && flow.slug !== null && flow.slug !== '') {
    const validation = validateSlug(flow.slug);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }
    slug = flow.slug.toLowerCase();

    const { data: existing } = await supabase
      .from('flows')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'A flow with this slug already exists' },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  const { data: newFlow, error } = await supabase
    .from('flows')
    .insert({
      name: flow.name,
      description: flow.description || null,
      slug: slug,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(newFlow, { status: 201, headers: corsHeaders });
}
