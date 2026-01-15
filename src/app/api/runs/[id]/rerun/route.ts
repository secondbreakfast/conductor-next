import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/runs/[id]/rerun - Create a new run based on an existing run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const sourceRunId = id.replace(/\.json$/, '');

  // Get the source run
  const { data: sourceRun, error: sourceRunError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', sourceRunId)
    .single();

  if (sourceRunError || !sourceRun) {
    return NextResponse.json(
      { error: sourceRunError?.message || 'Source run not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  // Check if a different flow_id was provided in the request body
  let flowId = sourceRun.flow_id;
  try {
    const body = await request.json();
    if (body.flow_id) {
      flowId = body.flow_id;
    }
  } catch {
    // No body or invalid JSON - use source run's flow_id
  }

  // Create a new run with the same inputs
  const { data: newRun, error: createError } = await supabase
    .from('runs')
    .insert({
      flow_id: flowId,
      input_image_url: sourceRun.input_image_url,
      attachment_urls: sourceRun.attachment_urls,
      variables: sourceRun.variables,
      webhook_url: sourceRun.webhook_url,
      source_run_id: sourceRunId,
      status: 'pending',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (createError || !newRun) {
    return NextResponse.json(
      { error: createError?.message || 'Failed to create run' },
      { status: 500, headers: corsHeaders }
    );
  }

  // Trigger execution asynchronously
  const baseUrl = request.nextUrl.origin;
  fetch(`${baseUrl}/api/runs/${newRun.id}/execute`, {
    method: 'POST',
  }).catch(console.error);

  return NextResponse.json(
    {
      id: newRun.id,
      source_run_id: sourceRunId,
      status: 'pending',
      redirect_url: `/runs/${newRun.id}`,
    },
    { status: 201, headers: corsHeaders }
  );
}
