import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/prompts - List all prompts
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const searchParams = request.nextUrl.searchParams;

  const flowId = searchParams.get('flow_id');

  let query = supabase
    .from('prompts')
    .select(`
      *,
      flow:flows(id, name)
    `)
    .order('position', { ascending: true });

  if (flowId) {
    query = query.eq('flow_id', flowId);
  }

  const { data: prompts, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(prompts, { headers: corsHeaders });
}

// POST /api/prompts - Create a new prompt
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

  const { prompt } = body;

  if (!prompt?.flow_id) {
    return NextResponse.json(
      { error: 'Flow ID is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  // Get the next position for this flow
  const { data: existingPrompts } = await supabase
    .from('prompts')
    .select('position')
    .eq('flow_id', prompt.flow_id)
    .order('position', { ascending: false })
    .limit(1);

  const nextPosition = existingPrompts && existingPrompts.length > 0
    ? ((existingPrompts[0].position as number) || 0) + 1
    : 0;

  const { data: newPrompt, error } = await supabase
    .from('prompts')
    .insert({
      flow_id: prompt.flow_id,
      type: prompt.type || 'Prompt',
      action: prompt.action || null,
      endpoint_type: prompt.endpoint_type || 'Chat',
      selected_provider: prompt.selected_provider || 'OpenAI',
      selected_model: prompt.selected_model || 'gpt-4o',
      system_prompt: prompt.system_prompt || null,
      tools: prompt.tools || [],
      background_prompt: prompt.background_prompt || null,
      foreground_prompt: prompt.foreground_prompt || null,
      negative_prompt: prompt.negative_prompt || null,
      preserve_original_subject: prompt.preserve_original_subject ?? null,
      original_background_depth: prompt.original_background_depth ?? null,
      keep_original_background: prompt.keep_original_background || false,
      light_source_direction: prompt.light_source_direction || null,
      light_source_strength: prompt.light_source_strength ?? null,
      seed: prompt.seed ?? null,
      output_format: prompt.output_format || null,
      size: prompt.size || null,
      quality: prompt.quality || null,
      subject_image_url: prompt.subject_image_url || null,
      background_reference_url: prompt.background_reference_url || null,
      attachment_urls: prompt.attachment_urls || [],
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(newPrompt, { status: 201, headers: corsHeaders });
}
