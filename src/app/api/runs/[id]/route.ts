import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { RunResponse, RunStatus } from '@/types/database';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '3600',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/runs/[id] - Get a single run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();

  // Handle .json suffix for backwards compatibility
  const runId = id.replace(/\.json$/, '');

  const { data: run, error } = await supabase
    .from('runs')
    .select(`
      *,
      flow:flows(id, name, description),
      prompt_runs(
        id,
        status,
        input_tokens,
        output_tokens,
        total_tokens,
        selected_provider,
        model,
        response,
        attachment_urls,
        source_attachment_urls,
        prompt:prompts(
          id,
          system_prompt,
          endpoint_type,
          selected_provider,
          selected_model,
          background_prompt,
          foreground_prompt,
          negative_prompt
        )
      )
    `)
    .eq('id', runId)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === 'PGRST116' ? 404 : 500, headers: corsHeaders }
    );
  }

  const baseUrl = getBaseUrl(request);
  const response = formatRunResponse(run, baseUrl);

  return NextResponse.json(response, { headers: corsHeaders });
}

// PUT/PATCH /api/runs/[id] - Update a run
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateRun(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return updateRun(request, params);
}

async function updateRun(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const runId = id.replace(/\.json$/, '');

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { run: updates } = body;

  const { data: run, error } = await supabase
    .from('runs')
    .update({
      ...(updates.status && { status: updates.status }),
      ...(updates.message !== undefined && { message: updates.message }),
      ...(updates.data && { data: updates.data }),
      ...(updates.completed_at && { completed_at: updates.completed_at }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  const baseUrl = getBaseUrl(request);
  const response = formatRunResponse(run, baseUrl);

  return NextResponse.json(response, { headers: corsHeaders });
}

// DELETE /api/runs/[id] - Delete a run
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const runId = id.replace(/\.json$/, '');

  const { error } = await supabase.from('runs').delete().eq('id', runId);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(
    { success: true },
    { status: 200, headers: corsHeaders }
  );
}

function formatRunResponse(run: Record<string, unknown>, baseUrl: string): RunResponse {
  return {
    id: run.id as string,
    flow_id: run.flow_id as string,
    status: run.status as RunStatus,
    started_at: run.started_at as string | null,
    completed_at: run.completed_at as string | null,
    created_at: run.created_at as string,
    updated_at: run.updated_at as string,
    data: (run.data as RunResponse['data']) || {},
    url: `${baseUrl}/api/runs/${run.id}.json`,
  };
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}
