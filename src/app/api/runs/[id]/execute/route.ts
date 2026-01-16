import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runPrompt } from '@/lib/runners';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/runs/[id]/execute - Execute a run's prompts using Vercel Workflow
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  'use workflow';

  const { id } = await params;
  const runId = id.replace(/\.json$/, '');

  // Step 1: Fetch and validate the run
  const run = await fetchRunStep(runId);

  if (!run) {
    return NextResponse.json(
      { error: 'Run not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  if (run.status === 'completed' || run.status === 'failed') {
    return NextResponse.json(
      { message: 'Run already processed', status: run.status },
      { headers: corsHeaders }
    );
  }

  const flow = run.flow as { id: string; name: string; prompts: Array<Record<string, unknown>> } | null;
  if (!flow || !flow.prompts || flow.prompts.length === 0) {
    await markRunFailedStep(runId, 'No prompts found in flow');
    return NextResponse.json(
      { error: 'No prompts found in flow' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Sort prompts by position
  const prompts = flow.prompts.sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      ((a.position as number) || 0) - ((b.position as number) || 0)
  );

  // Step 2: Execute each prompt in sequence
  let lastOutput: { image_url?: string; video_url?: string; text?: string } = {};
  const attachmentUrls = run.attachment_urls as string[] | undefined;
  // Use first attachment as the primary input image
  let inputImageUrl = attachmentUrls?.[0] || null;

  for (const prompt of prompts) {
    try {
      const result = await executePromptStep({
        prompt,
        run,
        runId,
        inputImageUrl,
        attachmentUrls,
      });

      // Use output as input for next prompt
      if (result.outputUrl) {
        inputImageUrl = result.outputUrl;
        if (result.outputType === 'image') {
          lastOutput.image_url = result.outputUrl;
        } else if (result.outputType === 'video') {
          lastOutput.video_url = result.outputUrl;
        }
      }
      if (result.text) {
        lastOutput.text = result.text;
      }
    } catch (promptError) {
      await markRunFailedStep(runId, promptError instanceof Error ? promptError.message : 'Unknown error');
      await triggerWebhookStep(run, 'run.failed');

      return NextResponse.json(
        { error: 'Prompt execution failed', details: promptError instanceof Error ? promptError.message : 'Unknown error' },
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // Step 3: Mark run as completed
  await markRunCompletedStep(runId, lastOutput);
  await triggerWebhookStep({ ...run, status: 'completed', data: lastOutput }, 'run.completed');

  return NextResponse.json(
    { success: true, status: 'completed', data: lastOutput },
    { headers: corsHeaders }
  );
}

// Step: Fetch run with flow and prompts
async function fetchRunStep(runId: string) {
  'use step';

  const supabase = createServiceClient();

  const { data: run, error } = await supabase
    .from('runs')
    .select(`
      *,
      flow:flows(
        id,
        name,
        prompts(*)
      )
    `)
    .eq('id', runId)
    .single();

  if (error) {
    console.error('Error fetching run:', error);
    return null;
  }

  return run;
}

// Step: Execute a single prompt (with automatic retries)
async function executePromptStep(params: {
  prompt: Record<string, unknown>;
  run: Record<string, unknown>;
  runId: string;
  inputImageUrl: string | null;
  attachmentUrls?: string[];
}) {
  'use step';

  const { prompt, run, runId, inputImageUrl, attachmentUrls } = params;
  const supabase = createServiceClient();

  // Get input media IDs from run if available
  const inputMediaIds = (run.input_media_ids as string[]) || [];

  // Create prompt run record
  const { data: promptRun, error: promptRunError } = await supabase
    .from('prompt_runs')
    .insert({
      prompt_id: prompt.id,
      run_id: runId,
      status: 'pending',
      selected_provider: prompt.selected_provider,
      model: prompt.selected_model,
      input_media_ids: inputMediaIds,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (promptRunError) {
    throw new Error(`Failed to create prompt run: ${promptRunError.message}`);
  }

  try {
    // Execute the prompt
    const result = await runPrompt({
      prompt,
      promptRun,
      run,
      inputImageUrl,
      attachmentUrls,
      supabase,
    });

    // Update prompt run with results
    await supabase
      .from('prompt_runs')
      .update({
        status: 'completed',
        response: result.response,
        input_tokens: result.tokens?.input || null,
        output_tokens: result.tokens?.output || null,
        total_tokens: result.tokens?.total || null,
        attachment_urls: result.attachmentUrls || [],
        output_media_ids: result.outputMediaIds || [],
        completed_at: new Date().toISOString(),
      })
      .eq('id', promptRun.id);

    return result;
  } catch (error) {
    // Update prompt run as failed
    await supabase
      .from('prompt_runs')
      .update({
        status: 'failed',
        response: { error: error instanceof Error ? error.message : 'Unknown error' },
        completed_at: new Date().toISOString(),
      })
      .eq('id', promptRun.id);

    throw error;
  }
}

// Step: Mark run as failed
async function markRunFailedStep(runId: string, errorMessage: string) {
  'use step';

  const supabase = createServiceClient();

  await supabase
    .from('runs')
    .update({
      status: 'failed',
      data: { error: errorMessage },
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

// Step: Mark run as completed
async function markRunCompletedStep(runId: string, data: Record<string, unknown>) {
  'use step';

  const supabase = createServiceClient();

  await supabase
    .from('runs')
    .update({
      status: 'completed',
      data,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

// Step: Trigger webhook
async function triggerWebhookStep(run: Record<string, unknown>, eventType: string) {
  'use step';

  if (!run.webhook_url) return;

  const supabase = createServiceClient();

  const payload = {
    type: eventType,
    data: {
      object: {
        id: run.id,
        flow_id: run.flow_id,
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        created_at: run.created_at,
        updated_at: run.updated_at,
        data: run.data,
        url: `/runs/${run.id}.json`,
      },
    },
    created: Math.floor(Date.now() / 1000),
  };

  // Create webhook record
  await supabase.from('run_webhooks').insert({
    run_id: run.id as string,
    event_type: eventType,
    payload,
    status: 'pending',
    endpoint_url: run.webhook_url as string,
    attempt_count: 0,
  });

  // Deliver webhook
  try {
    const response = await fetch(run.webhook_url as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await supabase
      .from('run_webhooks')
      .update({
        status: response.ok ? 'delivered' : 'failed',
        attempt_count: 1,
        last_attempted_at: new Date().toISOString(),
        error_message: response.ok ? null : `HTTP ${response.status}`,
      })
      .eq('run_id', run.id as string)
      .eq('event_type', eventType);
  } catch (error) {
    await supabase
      .from('run_webhooks')
      .update({
        status: 'failed',
        attempt_count: 1,
        last_attempted_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('run_id', run.id as string)
      .eq('event_type', eventType);
  }
}
