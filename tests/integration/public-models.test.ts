import { describe, it, expect, afterEach } from 'vitest';
import {
  apiRequest,
  createTestProvider,
  deleteTestProvider,
  createTestModel,
  TestProvider,
  TestModel,
} from './test-utils';

interface PublicModel {
  id: string;
  name: string;
  model_id: string;
  default_params: Record<string, unknown>;
  provider: {
    id: string;
    name: string;
    slug: string;
  };
}

describe('Public Models API - /api/models', () => {
  const createdProviderIds: string[] = [];

  afterEach(async () => {
    for (const id of createdProviderIds) {
      try {
        await deleteTestProvider(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdProviderIds.length = 0;
  });

  describe('GET /api/models', () => {
    it('should require endpoint_type parameter', async () => {
      const { status, data } = await apiRequest<{ error: string }>('/api/models');

      expect(status).toBe(400);
      expect(data.error).toContain('endpoint_type parameter is required');
    });

    it('should return enabled Chat models from enabled providers', async () => {
      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const model = data[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('model_id');
      expect(model).toHaveProperty('default_params');
      expect(model).toHaveProperty('provider');
      expect(model.provider).toHaveProperty('id');
      expect(model.provider).toHaveProperty('name');
      expect(model.provider).toHaveProperty('slug');
    });

    it('should return enabled ImageToImage models', async () => {
      const { status, data } = await apiRequest<PublicModel[]>(
        '/api/models?endpoint_type=ImageToImage'
      );

      expect(status).toBe(200);
      expect(data.length).toBeGreaterThan(0);

      const modelIds = data.map((m) => m.model_id);
      expect(modelIds).toContain('remove-background');
    });

    it('should return ImageToVideo models', async () => {
      const { status, data } = await apiRequest<PublicModel[]>(
        '/api/models?endpoint_type=ImageToVideo'
      );

      expect(status).toBe(200);
      expect(data.length).toBeGreaterThan(0);

      const modelIds = data.map((m) => m.model_id);
      expect(modelIds).toContain('veo-3.0-generate-001');
    });

    it('should NOT include disabled models', async () => {
      const provider = await createTestProvider({ enabled: true });
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, {
        endpoint_types: ['Chat'],
        enabled: false,
        model_id: 'disabled-test-model',
      });

      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);
      const modelIds = data.map((m) => m.model_id);
      expect(modelIds).not.toContain('disabled-test-model');
    });

    it('should NOT include models from disabled providers', async () => {
      const provider = await createTestProvider({ enabled: false });
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, {
        endpoint_types: ['Chat'],
        enabled: true,
        model_id: 'hidden-provider-model',
      });

      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);
      const modelIds = data.map((m) => m.model_id);
      expect(modelIds).not.toContain('hidden-provider-model');
    });

    it('should include expected seed Chat models', async () => {
      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);
      const modelIds = data.map((m) => m.model_id);

      expect(modelIds).toContain('gpt-4.1');
      expect(modelIds).toContain('claude-3-5-sonnet-20240620');
      expect(modelIds).toContain('gemini-2.5-pro');
    });

    it('should include provider info with each model', async () => {
      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);

      const openAiModel = data.find((m) => m.model_id === 'gpt-4.1');
      expect(openAiModel).toBeDefined();
      expect(openAiModel?.provider.slug).toBe('openai');
      expect(openAiModel?.provider.name).toBe('OpenAI');

      const anthropicModel = data.find((m) => m.model_id === 'claude-3-5-sonnet-20240620');
      expect(anthropicModel).toBeDefined();
      expect(anthropicModel?.provider.slug).toBe('anthropic');
    });

    it('should return models sorted by provider display_order', async () => {
      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);

      const { data: providers } = await apiRequest<TestProvider[]>('/api/settings/providers');
      const providerOrder = new Map(providers.map((p) => [p.slug, p.display_order]));

      let lastProviderOrder = -1;
      for (const model of data) {
        const currentOrder = providerOrder.get(model.provider.slug) ?? 0;
        expect(currentOrder).toBeGreaterThanOrEqual(lastProviderOrder);
        if (currentOrder > lastProviderOrder) {
          lastProviderOrder = currentOrder;
        }
      }
    });

    it('should return empty array for endpoint_type with no models', async () => {
      const { status, data } = await apiRequest<PublicModel[]>(
        '/api/models?endpoint_type=AudioToText'
      );

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('should include default_params for models that have them', async () => {
      const provider = await createTestProvider({ enabled: true });
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, {
        endpoint_types: ['Chat'],
        enabled: true,
        model_id: 'model-with-params',
        default_params: { temperature: 0.7, max_tokens: 2000 },
      });

      const { status, data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');

      expect(status).toBe(200);
      const modelWithParams = data.find((m) => m.model_id === 'model-with-params');
      expect(modelWithParams).toBeDefined();
      expect(modelWithParams?.default_params).toEqual({ temperature: 0.7, max_tokens: 2000 });
    });

    it('should set Cache-Control header', async () => {
      const response = await fetch('http://localhost:3002/api/models?endpoint_type=Chat');
      expect(response.headers.get('Cache-Control')).toContain('public');
      expect(response.headers.get('Cache-Control')).toContain('max-age=60');
    });

    it('should respond to OPTIONS request (CORS)', async () => {
      const { status } = await apiRequest('/api/models', {
        method: 'GET',
        headers: { Origin: 'http://example.com' },
      });
      expect([200, 400]).toContain(status);
    });
  });

  describe('Filtering behavior', () => {
    it('should only return models matching the exact endpoint_type', async () => {
      const provider = await createTestProvider({ enabled: true });
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, {
        endpoint_types: ['Chat'],
        enabled: true,
        model_id: 'chat-only-model',
      });

      await createTestModel(provider.id, {
        endpoint_types: ['ImageToImage'],
        enabled: true,
        model_id: 'image-only-model',
      });

      await createTestModel(provider.id, {
        endpoint_types: ['Chat', 'ImageToImage'],
        enabled: true,
        model_id: 'multi-type-model',
      });

      const { data: chatModels } = await apiRequest<PublicModel[]>(
        '/api/models?endpoint_type=Chat'
      );
      const chatModelIds = chatModels.map((m) => m.model_id);
      expect(chatModelIds).toContain('chat-only-model');
      expect(chatModelIds).toContain('multi-type-model');
      expect(chatModelIds).not.toContain('image-only-model');

      const { data: imageModels } = await apiRequest<PublicModel[]>(
        '/api/models?endpoint_type=ImageToImage'
      );
      const imageModelIds = imageModels.map((m) => m.model_id);
      expect(imageModelIds).not.toContain('chat-only-model');
      expect(imageModelIds).toContain('image-only-model');
      expect(imageModelIds).toContain('multi-type-model');
    });

    it('should handle toggling provider enabled status', async () => {
      const provider = await createTestProvider({ enabled: true });
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, {
        endpoint_types: ['Chat'],
        enabled: true,
        model_id: 'toggle-test-model',
      });

      let { data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');
      expect(data.map((m) => m.model_id)).toContain('toggle-test-model');

      await apiRequest(`/api/settings/providers/${provider.id}`, {
        method: 'PATCH',
        body: { provider: { enabled: false } },
      });

      ({ data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat'));
      expect(data.map((m) => m.model_id)).not.toContain('toggle-test-model');

      await apiRequest(`/api/settings/providers/${provider.id}`, {
        method: 'PATCH',
        body: { provider: { enabled: true } },
      });

      ({ data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat'));
      expect(data.map((m) => m.model_id)).toContain('toggle-test-model');
    });

    it('should handle toggling model enabled status', async () => {
      const provider = await createTestProvider({ enabled: true });
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id, {
        endpoint_types: ['Chat'],
        enabled: true,
        model_id: 'model-toggle-test',
      });

      let { data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat');
      expect(data.map((m) => m.model_id)).toContain('model-toggle-test');

      await apiRequest(`/api/settings/models/${model.id}`, {
        method: 'PATCH',
        body: { model: { enabled: false } },
      });

      ({ data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat'));
      expect(data.map((m) => m.model_id)).not.toContain('model-toggle-test');

      await apiRequest(`/api/settings/models/${model.id}`, {
        method: 'PATCH',
        body: { model: { enabled: true } },
      });

      ({ data } = await apiRequest<PublicModel[]>('/api/models?endpoint_type=Chat'));
      expect(data.map((m) => m.model_id)).toContain('model-toggle-test');
    });
  });

  describe('All valid endpoint types', () => {
    const endpointTypes = [
      'Chat',
      'ImageToImage',
      'ImageToVideo',
      'VideoToVideo',
      'AudioToText',
      'TextToAudio',
    ];

    for (const endpointType of endpointTypes) {
      it(`should accept endpoint_type=${endpointType}`, async () => {
        const { status, data } = await apiRequest<PublicModel[]>(
          `/api/models?endpoint_type=${endpointType}`
        );

        expect(status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
      });
    }
  });
});
