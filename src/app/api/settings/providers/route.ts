import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { auth } from '@/lib/auth';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: corsHeaders }
    );
  }

  const supabase = createServiceClient();

  const { data: providers, error } = await supabase
    .from('providers')
    .select(`
      *,
      models(id, enabled)
    `)
    .order('display_order', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  const transformedProviders = providers.map((provider) => {
    const models = provider.models as Array<{ id: string; enabled: boolean }> || [];
    return {
      ...provider,
      models: undefined,
      models_count: models.length,
      enabled_models_count: models.filter((m) => m.enabled).length,
    };
  });

  return NextResponse.json(transformedProviders, { headers: corsHeaders });
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

  const { provider } = body;

  if (!provider?.name) {
    return NextResponse.json(
      { error: 'Provider name is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!provider?.slug) {
    return NextResponse.json(
      { error: 'Provider slug is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const slug = provider.slug.toLowerCase();

  const { data: existing } = await supabase
    .from('providers')
    .select('id')
    .eq('slug', slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: 'A provider with this slug already exists' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: newProvider, error } = await supabase
    .from('providers')
    .insert({
      name: provider.name,
      slug: slug,
      enabled: provider.enabled ?? true,
      display_order: provider.display_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  return NextResponse.json(newProvider, { status: 201, headers: corsHeaders });
}
