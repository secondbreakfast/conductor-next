import { describe, it, expect, afterEach } from 'vitest';
import {
  apiRequest,
  generateSlug,
  createTestProvider,
  deleteTestProvider,
  createTestModel,
  deleteTestModel,
  TestProvider,
  TestModel,
} from './test-utils';

describe('Models API - /api/settings/models', () => {
  const createdProviderIds: string[] = [];
  const createdModelIds: string[] = [];

  afterEach(async () => {
    for (const id of createdModelIds) {
      try {
        await deleteTestModel(id);
      } catch {
        // Ignore cleanup errors - might already be deleted via cascade
      }
    }
    createdModelIds.length = 0;

    for (const id of createdProviderIds) {
      try {
        await deleteTestProvider(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    createdProviderIds.length = 0;
  });

  describe('GET /api/settings/models', () => {
    it('should return all models with provider info', async () => {
      const { status, data } = await apiRequest<TestModel[]>('/api/settings/models');

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const model = data[0];
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('model_id');
      expect(model).toHaveProperty('endpoint_types');
      expect(model).toHaveProperty('enabled');
      expect(model).toHaveProperty('provider');
      expect(model.provider).toHaveProperty('name');
      expect(model.provider).toHaveProperty('slug');
    });

    it('should filter models by provider_id', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel[]>(
        `/api/settings/models?provider_id=${provider.id}`
      );

      expect(status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].id).toBe(model.id);
    });

    it('should filter models by endpoint_type', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, { endpoint_types: ['Chat'] });
      await createTestModel(provider.id, { endpoint_types: ['ImageToImage'] });

      const { status, data } = await apiRequest<TestModel[]>(
        '/api/settings/models?endpoint_type=Chat'
      );

      expect(status).toBe(200);
      const chatModels = data.filter((m) => m.endpoint_types.includes('Chat'));
      expect(chatModels.length).toBeGreaterThan(0);
    });

    it('should filter models by enabled status', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      await createTestModel(provider.id, { enabled: true });
      const disabledModel = await createTestModel(provider.id, { enabled: false });
      createdModelIds.push(disabledModel.id);

      const { status, data } = await apiRequest<TestModel[]>(
        `/api/settings/models?provider_id=${provider.id}&enabled=true`
      );

      expect(status).toBe(200);
      expect(data.every((m) => m.enabled === true)).toBe(true);
    });

    it('should include seed models', async () => {
      const { status, data } = await apiRequest<TestModel[]>('/api/settings/models');

      expect(status).toBe(200);
      const modelIds = data.map((m) => m.model_id);
      expect(modelIds).toContain('gpt-4.1');
      expect(modelIds).toContain('claude-3-5-sonnet-20240620');
      expect(modelIds).toContain('gemini-2.5-pro');
    });
  });

  describe('POST /api/settings/models', () => {
    it('should create a new model with required fields', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const modelId = generateSlug('model');
      const { status, data } = await apiRequest<TestModel>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            name: 'Test Model',
            model_id: modelId,
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Model');
      expect(data.model_id).toBe(modelId);
      expect(data.endpoint_types).toEqual(['Chat']);
      expect(data.enabled).toBe(true);
      expect(data.display_order).toBe(0);
      expect(data.provider?.id).toBe(provider.id);

      createdModelIds.push(data.id);
    });

    it('should create a model with all optional fields', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const modelId = generateSlug('model');
      const { status, data } = await apiRequest<TestModel>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            name: 'Full Model',
            model_id: modelId,
            endpoint_types: ['Chat', 'ImageToImage'],
            enabled: false,
            display_order: 50,
            default_params: { temperature: 0.7, max_tokens: 1000 },
            input_price: 0.001,
            output_price: 0.002,
          },
        },
      });

      expect(status).toBe(201);
      expect(data.enabled).toBe(false);
      expect(data.display_order).toBe(50);
      expect(data.default_params).toEqual({ temperature: 0.7, max_tokens: 1000 });
      expect(Number(data.input_price)).toBeCloseTo(0.001);
      expect(Number(data.output_price)).toBeCloseTo(0.002);
      expect(data.endpoint_types).toContain('Chat');
      expect(data.endpoint_types).toContain('ImageToImage');

      createdModelIds.push(data.id);
    });

    it('should require provider_id', async () => {
      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            name: 'Test',
            model_id: 'test',
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('Provider ID');
    });

    it('should require name', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            model_id: 'test',
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('name');
    });

    it('should require model_id', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            name: 'Test',
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('Model ID');
    });

    it('should require at least one endpoint_type', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            name: 'Test',
            model_id: 'test',
            endpoint_types: [],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('endpoint type');
    });

    it('should reject invalid endpoint_types', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            name: 'Test',
            model_id: 'test',
            endpoint_types: ['InvalidType'],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('Invalid endpoint types');
      expect(data.error).toContain('InvalidType');
    });

    it('should reject non-existent provider_id', async () => {
      const fakeProviderId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: fakeProviderId,
            name: 'Test',
            model_id: 'test',
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('Provider not found');
    });

    it('should reject duplicate model_id for same provider', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const modelId = generateSlug('model');
      const model = await createTestModel(provider.id, { model_id: modelId });
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<{ error: string }>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider.id,
            name: 'Duplicate',
            model_id: modelId,
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('already exists');
    });

    it('should allow same model_id for different providers', async () => {
      const provider1 = await createTestProvider();
      createdProviderIds.push(provider1.id);
      const provider2 = await createTestProvider();
      createdProviderIds.push(provider2.id);

      const modelId = generateSlug('shared-model');

      const model1 = await createTestModel(provider1.id, { model_id: modelId });
      createdModelIds.push(model1.id);

      const { status, data } = await apiRequest<TestModel>('/api/settings/models', {
        method: 'POST',
        body: {
          model: {
            provider_id: provider2.id,
            name: 'Same ID Different Provider',
            model_id: modelId,
            endpoint_types: ['Chat'],
          },
        },
      });

      expect(status).toBe(201);
      createdModelIds.push(data.id);
    });
  });

  describe('GET /api/settings/models/[id]', () => {
    it('should return a single model with provider info', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel>(`/api/settings/models/${model.id}`);

      expect(status).toBe(200);
      expect(data.id).toBe(model.id);
      expect(data.name).toBe(model.name);
      expect(data.provider?.id).toBe(provider.id);
    });

    it('should return 404 for non-existent model', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/models/${fakeId}`
      );

      expect(status).toBe(404);
      expect(data.error).toBe('Model not found');
    });
  });

  describe('PATCH /api/settings/models/[id]', () => {
    it('should update model name', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { name: 'Updated Model Name' } },
        }
      );

      expect(status).toBe(200);
      expect(data.name).toBe('Updated Model Name');
    });

    it('should update model enabled status', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id, { enabled: true });
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { enabled: false } },
        }
      );

      expect(status).toBe(200);
      expect(data.enabled).toBe(false);
    });

    it('should update model endpoint_types', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id, { endpoint_types: ['Chat'] });
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { endpoint_types: ['Chat', 'ImageToImage'] } },
        }
      );

      expect(status).toBe(200);
      expect(data.endpoint_types).toContain('Chat');
      expect(data.endpoint_types).toContain('ImageToImage');
    });

    it('should update model default_params', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { default_params: { temperature: 0.5 } } },
        }
      );

      expect(status).toBe(200);
      expect(data.default_params).toEqual({ temperature: 0.5 });
    });

    it('should update model pricing', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<TestModel>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { input_price: 0.01, output_price: 0.02 } },
        }
      );

      expect(status).toBe(200);
      expect(Number(data.input_price)).toBeCloseTo(0.01);
      expect(Number(data.output_price)).toBeCloseTo(0.02);
    });

    it('should reject empty endpoint_types on update', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { endpoint_types: [] } },
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain('endpoint type');
    });

    it('should reject invalid endpoint_types on update', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);
      createdModelIds.push(model.id);

      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/models/${model.id}`,
        {
          method: 'PATCH',
          body: { model: { endpoint_types: ['BadType'] } },
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain('Invalid endpoint types');
    });

    it('should reject duplicate model_id on update', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model1 = await createTestModel(provider.id);
      createdModelIds.push(model1.id);

      const model2 = await createTestModel(provider.id);
      createdModelIds.push(model2.id);

      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/models/${model2.id}`,
        {
          method: 'PATCH',
          body: { model: { model_id: model1.model_id } },
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain('already exists');
    });

    it('should return 404 for non-existent model', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/models/${fakeId}`,
        {
          method: 'PATCH',
          body: { model: { name: 'Test' } },
        }
      );

      expect(status).toBe(404);
      expect(data.error).toBe('Model not found');
    });
  });

  describe('DELETE /api/settings/models/[id]', () => {
    it('should delete a model', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);

      const { status, data } = await apiRequest<{ success: boolean; prompts_affected: number }>(
        `/api/settings/models/${model.id}`,
        { method: 'DELETE' }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(typeof data.prompts_affected).toBe('number');

      const { status: getStatus } = await apiRequest(`/api/settings/models/${model.id}`);
      expect(getStatus).toBe(404);
    });

    it('should return 404 for non-existent model', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/models/${fakeId}`,
        { method: 'DELETE' }
      );

      expect(status).toBe(404);
      expect(data.error).toBe('Model not found');
    });
  });
});
