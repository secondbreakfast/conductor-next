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

// POST /api/runs/[id]/execute - Execute a run's prompts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServiceClient();
  const runId = id.replace(/\.json$/, '');

  // Get the run with its flow and prompts
  const { data: run, error: runError } = await supabase
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

  if (runError || !run) {
    return NextResponse.json(
      { error: runError?.message || 'Run not found' },
      { status: 404, headers: corsHeaders }
    );
  }

  // Check if run is already completed or failed
  if (run.status === 'completed' || run.status === 'failed') {
    return NextResponse.json(
      { message: 'Run already processed', status: run.status },
      { headers: corsHeaders }
    );
  }

  const flow = run.flow as { id: string; name: string; prompts: Array<Record<string, unknown>> } | null;
  if (!flow || !flow.prompts || flow.prompts.length === 0) {
    // Mark run as failed if no prompts
    await supabase
      .from('runs')
      .update({ status: 'failed', data: { error: 'No prompts found in flow' } })
      .eq('id', runId);

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

  try {
    // Execute each prompt in sequence
    let lastOutput: { image_url?: string; video_url?: string; text?: string } = {};
    let inputImageUrl = run.input_image_url;

    for (const prompt of prompts) {
      // Create prompt run record
      const { data: promptRun, error: promptRunError } = await supabase
        .from('prompt_runs')
        .insert({
          prompt_id: prompt.id,
          run_id: runId,
          status: 'pending',
          selected_provider: prompt.selected_provider,
          model: prompt.selected_model,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (promptRunError) {
        console.error('Error creating prompt run:', promptRunError);
        continue;
      }

      try {
        // Execute the prompt
        const result = await runPrompt({
          prompt,
          promptRun,
          run,
          inputImageUrl,
          attachmentUrls: run.attachment_urls as string[] | undefined,
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
            completed_at: new Date().toISOString(),
          })
          .eq('id', promptRun.id);

        // Use output as input for next prompt if applicable
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
        console.error('Error executing prompt:', promptError);

        // Update prompt run as failed
        await supabase
          .from('prompt_runs')
          .update({
            status: 'failed',
            response: { error: promptError instanceof Error ? promptError.message : 'Unknown error' },
            completed_at: new Date().toISOString(),
          })
          .eq('id', promptRun.id);

        // Mark run as failed
        await supabase
          .from('runs')
          .update({
            status: 'failed',
            data: { error: promptError instanceof Error ? promptError.message : 'Unknown error' },
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId);

        // Trigger webhook for failure
        await triggerWebhook(supabase, run, 'run.failed');

        return NextResponse.json(
          { error: 'Prompt execution failed', details: promptError instanceof Error ? promptError.message : 'Unknown error' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Update run as completed with output data
    await supabase
      .from('runs')
      .update({
        status: 'completed',
        data: lastOutput,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    // Trigger webhook for completion
    await triggerWebhook(supabase, { ...run, status: 'completed', data: lastOutput }, 'run.completed');

    return NextResponse.json(
      { success: true, status: 'completed', data: lastOutput },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error executing run:', error);

    await supabase
      .from('runs')
      .update({
        status: 'failed',
        data: { error: error instanceof Error ? error.message : 'Unknown error' },
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);

    // Trigger webhook for failure
    await triggerWebhook(supabase, run, 'run.failed');

    return NextResponse.json(
      { error: 'Run execution failed' },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function triggerWebhook(
  supabase: ReturnType<typeof createServiceClient>,
  run: Record<string, unknown>,
  eventType: string
) {
  if (!run.webhook_url) return;

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

  // Deliver webhook asynchronously
  try {
    const response = await fetch(run.webhook_url as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Update webhook status
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
