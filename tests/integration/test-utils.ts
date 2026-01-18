const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3002';

export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: FetchOptions = {}
): Promise<{ status: number; data: T }> {
  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  return { status: response.status, data };
}

export function generateSlug(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface TestProvider {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TestModel {
  id: string;
  provider_id: string;
  name: string;
  model_id: string;
  endpoint_types: string[];
  enabled: boolean;
  display_order: number;
  default_params: Record<string, unknown>;
  input_price: number | null;
  output_price: number | null;
  created_at: string;
  updated_at: string;
  provider?: {
    id: string;
    name: string;
    slug: string;
  };
}

export async function createTestProvider(overrides: Partial<{
  name: string;
  slug: string;
  enabled: boolean;
  display_order: number;
}> = {}): Promise<TestProvider> {
  const slug = overrides.slug || generateSlug('provider');
  const { data } = await apiRequest<TestProvider>('/api/settings/providers', {
    method: 'POST',
    body: {
      provider: {
        name: overrides.name || `Test Provider ${slug}`,
        slug,
        enabled: overrides.enabled ?? true,
        display_order: overrides.display_order ?? 999,
      },
    },
  });
  return data;
}

export async function deleteTestProvider(id: string): Promise<void> {
  await apiRequest(`/api/settings/providers/${id}`, { method: 'DELETE' });
}

export async function createTestModel(
  providerId: string,
  overrides: Partial<{
    name: string;
    model_id: string;
    endpoint_types: string[];
    enabled: boolean;
    display_order: number;
    default_params: Record<string, unknown>;
    input_price: number;
    output_price: number;
  }> = {}
): Promise<TestModel> {
  const modelId = overrides.model_id || generateSlug('model');
  const { data } = await apiRequest<TestModel>('/api/settings/models', {
    method: 'POST',
    body: {
      model: {
        provider_id: providerId,
        name: overrides.name || `Test Model ${modelId}`,
        model_id: modelId,
        endpoint_types: overrides.endpoint_types || ['Chat'],
        enabled: overrides.enabled ?? true,
        display_order: overrides.display_order ?? 999,
        default_params: overrides.default_params ?? {},
        input_price: overrides.input_price,
        output_price: overrides.output_price,
      },
    },
  });
  return data;
}

export async function deleteTestModel(id: string): Promise<void> {
  await apiRequest(`/api/settings/models/${id}`, { method: 'DELETE' });
}
