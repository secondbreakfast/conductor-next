import { NextRequest, NextResponse, after } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { CreateRunRequest, RunResponse } from '@/types/database';
import { isUUID, resolveFlowByIdentifier } from '@/lib/slug';

// CORS headers for external API access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '3600',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/runs - List all runs with pagination
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const searchParams = request.nextUrl.searchParams;

  const cursor = searchParams.get('cursor');
  const limit = parseInt(searchParams.get('limit') || '20');
  const flowId = searchParams.get('flow_id');
  const status = searchParams.get('status');
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  let query = supabase
    .from('runs')
    .select(`
      *,
      flow:flows(id, name),
      prompt_runs(
        id,
        status,
        input_tokens,
        output_tokens,
        total_tokens,
        selected_provider,
        model,
        prompt:prompts(id, system_prompt, endpoint_type, selected_provider, selected_model)
      )
    `)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .limit(limit);

  // Apply filters
  if (flowId) {
    query = query.eq('flow_id', flowId);
  }
  if (status) {
    query = query.eq('status', status);
  }
  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: runs, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  // Transform to match Rails API response format
  const transformedRuns = runs.map((run) => formatRunResponse(run, request));

  return NextResponse.json(transformedRuns, { headers: corsHeaders });
}

// POST /api/runs - Create a new run
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  let body: CreateRunRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { run: runData } = body;

  if (!runData) {
    return NextResponse.json(
      { error: 'Missing run data' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Convert flow_id to UUID format if it's a number (backwards compatibility)
  let flowId = runData.flow_id;
  if (typeof flowId === 'number') {
    const legacyFlowMap: Record<number, string> = {
      1: '00000000-0000-0000-0000-000000000001',
      2: '00000000-0000-0000-0000-000000000002',
      3: '00000000-0000-0000-0000-000000000003',
    };
    flowId = legacyFlowMap[flowId] || flowId.toString();
  }

  // Resolve flow by slug if not a UUID
  if (typeof flowId === 'string' && !isUUID(flowId)) {
    const resolved = await resolveFlowByIdentifier(supabase, flowId);
    if (!resolved) {
      return NextResponse.json(
        { error: 'Flow not found' },
        { status: 404, headers: corsHeaders }
      );
    }
    flowId = resolved.id;
  }

  // Build attachment_urls - support legacy input_image_url by prepending it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyInputImageUrl = (runData as any).input_image_url;
  let attachmentUrls = runData.attachment_urls || [];
  if (legacyInputImageUrl && !attachmentUrls.includes(legacyInputImageUrl)) {
    attachmentUrls = [legacyInputImageUrl, ...attachmentUrls];
  }

  // Get input media IDs if provided
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputMediaIds = (runData as any).input_media_ids || [];

  // Create the run
  const { data: run, error: createError } = await supabase
    .from('runs')
    .insert({
      flow_id: flowId,
      message: runData.message || null,
      webhook_url: runData.webhook_url || null,
      variables: runData.variables || {},
      attachment_urls: attachmentUrls,
      input_media_ids: inputMediaIds,
      conversation_id: runData.conversation_id || null,
      status: 'pending',
      started_at: new Date().toISOString(),
      data: {},
    })
    .select()
    .single();

  if (createError) {
    console.error('Error creating run:', createError);
    return NextResponse.json(
      { error: createError.message },
      { status: 500, headers: corsHeaders }
    );
  }

  // Trigger the run execution using after() to ensure the fetch completes
  // before the serverless function terminates
  const baseUrl = getBaseUrl(request);
  after(async () => {
    try {
      const response = await fetch(`${baseUrl}/api/runs/${run.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        console.error(`Execute trigger failed for run ${run.id}: ${response.status}`);
      }
    } catch (err) {
      console.error(`Error triggering run execution for ${run.id}:`, err);
    }
  });

  // Return the run in Rails API format
  const response = formatRunResponse(run, request);

  return NextResponse.json(response, { status: 201, headers: corsHeaders });
}

// Helper to format run response to match Rails API
function formatRunResponse(run: Record<string, unknown>, request: NextRequest): RunResponse {
  const baseUrl = getBaseUrl(request);

  return {
    id: run.id as string,
    flow_id: run.flow_id as string,
    status: run.status as RunResponse['status'],
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
