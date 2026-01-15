import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
  'Cache-Control': 'public, max-age=60',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const searchParams = request.nextUrl.searchParams;

  const endpointType = searchParams.get('endpoint_type');
  if (!endpointType) {
    return NextResponse.json(
      { error: 'endpoint_type parameter is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const { data: models, error } = await supabase
    .from('models')
    .select(`
      id,
      name,
      model_id,
      default_params,
      provider:providers!inner(id, name, slug, enabled, display_order)
    `)
    .eq('enabled', true)
    .eq('providers.enabled', true)
    .contains('endpoint_types', [endpointType])
    .order('display_order', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }

  type ProviderInfo = { id: string; name: string; slug: string; enabled: boolean; display_order: number };

  const sortedModels = models.sort((a, b) => {
    const providerA = a.provider as unknown as ProviderInfo;
    const providerB = b.provider as unknown as ProviderInfo;
    return providerA.display_order - providerB.display_order;
  });

  const result = sortedModels.map((model) => {
    const provider = model.provider as unknown as ProviderInfo;
    return {
      id: model.id,
      name: model.name,
      model_id: model.model_id,
      default_params: model.default_params,
      provider: {
        id: provider.id,
        name: provider.name,
        slug: provider.slug,
      },
    };
  });

  return NextResponse.json(result, { headers: corsHeaders });
}
