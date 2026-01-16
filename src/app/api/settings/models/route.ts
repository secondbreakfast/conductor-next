import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

const VALID_ENDPOINT_TYPES = [
  'Chat',
  'ImageToImage',
  'ImageToVideo',
  'VideoToVideo',
  'AudioToText',
  'TextToAudio',
];

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const supabase = createServiceClient();
  const searchParams = request.nextUrl.searchParams;

  let query = supabase
    .from('models')
    .select(`
      *,
      provider:providers(id, name, slug)
    `)
    .order('display_order', { ascending: true });

  const providerId = searchParams.get('provider_id');
  if (providerId) {
    query = query.eq('provider_id', providerId);
  }

  const endpointType = searchParams.get('endpoint_type');
  if (endpointType) {
    query = query.contains('endpoint_types', [endpointType]);
  }

  const enabled = searchParams.get('enabled');
  if (enabled === 'true') {
    query = query.eq('enabled', true);
  } else if (enabled === 'false') {
    query = query.eq('enabled', false);
  }

  const { data: models, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(models, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

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

  const { model } = body;

  if (!model?.provider_id) {
    return NextResponse.json(
      { error: 'Provider ID is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!model?.name) {
    return NextResponse.json(
      { error: 'Model name is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!model?.model_id) {
    return NextResponse.json(
      { error: 'Model ID is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!model?.endpoint_types || !Array.isArray(model.endpoint_types) || model.endpoint_types.length === 0) {
    return NextResponse.json(
      { error: 'At least one endpoint type is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const invalidTypes = model.endpoint_types.filter(
    (t: string) => !VALID_ENDPOINT_TYPES.includes(t)
  );
  if (invalidTypes.length > 0) {
    return NextResponse.json(
      { error: `Invalid endpoint types: ${invalidTypes.join(', ')}` },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: provider } = await supabase
    .from('providers')
    .select('id')
    .eq('id', model.provider_id)
    .single();

  if (!provider) {
    return NextResponse.json(
      { error: 'Provider not found' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: existingModel } = await supabase
    .from('models')
    .select('id')
    .eq('provider_id', model.provider_id)
    .eq('model_id', model.model_id)
    .single();

  if (existingModel) {
    return NextResponse.json(
      { error: 'A model with this ID already exists for this provider' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: newModel, error } = await supabase
    .from('models')
    .insert({
      provider_id: model.provider_id,
      name: model.name,
      model_id: model.model_id,
      endpoint_types: model.endpoint_types,
      enabled: model.enabled ?? true,
      display_order: model.display_order ?? 0,
      default_params: model.default_params ?? {},
      input_price: model.input_price ?? null,
      output_price: model.output_price ?? null,
    })
    .select(`
      *,
      provider:providers(id, name, slug)
    `)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(newModel, { status: 201, headers: corsHeaders });
}
