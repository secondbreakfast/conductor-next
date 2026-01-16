import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import {
  apiRequest,
  generateSlug,
  createTestProvider,
  deleteTestProvider,
  createTestModel,
  TestProvider,
} from './test-utils';

describe('Providers API - /api/settings/providers', () => {
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

  describe('GET /api/settings/providers', () => {
    it('should return all providers with model counts', async () => {
      const { status, data } = await apiRequest<TestProvider[]>('/api/settings/providers');

      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);

      const provider = data[0];
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('slug');
      expect(provider).toHaveProperty('enabled');
      expect(provider).toHaveProperty('display_order');
      expect(provider).toHaveProperty('models_count');
      expect(provider).toHaveProperty('enabled_models_count');
    });

    it('should return providers ordered by display_order', async () => {
      const { status, data } = await apiRequest<TestProvider[]>('/api/settings/providers');

      expect(status).toBe(200);
      for (let i = 1; i < data.length; i++) {
        expect(data[i].display_order).toBeGreaterThanOrEqual(data[i - 1].display_order);
      }
    });

    it('should include expected seed providers', async () => {
      const { status, data } = await apiRequest<TestProvider[]>('/api/settings/providers');

      expect(status).toBe(200);
      const slugs = data.map((p) => p.slug);
      expect(slugs).toContain('openai');
      expect(slugs).toContain('anthropic');
      expect(slugs).toContain('gemini');
      expect(slugs).toContain('stability');
    });
  });

  describe('POST /api/settings/providers', () => {
    it('should create a new provider with required fields', async () => {
      const slug = generateSlug('provider');
      const { status, data } = await apiRequest<TestProvider>('/api/settings/providers', {
        method: 'POST',
        body: {
          provider: {
            name: 'Test Provider',
            slug,
          },
        },
      });

      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Provider');
      expect(data.slug).toBe(slug);
      expect(data.enabled).toBe(true);
      expect(data.display_order).toBe(0);

      createdProviderIds.push(data.id);
    });

    it('should create a provider with all optional fields', async () => {
      const slug = generateSlug('provider');
      const { status, data } = await apiRequest<TestProvider>('/api/settings/providers', {
        method: 'POST',
        body: {
          provider: {
            name: 'Full Provider',
            slug,
            enabled: false,
            display_order: 100,
          },
        },
      });

      expect(status).toBe(201);
      expect(data.enabled).toBe(false);
      expect(data.display_order).toBe(100);

      createdProviderIds.push(data.id);
    });

    it('should convert slug to lowercase', async () => {
      const { status, data } = await apiRequest<TestProvider>('/api/settings/providers', {
        method: 'POST',
        body: {
          provider: {
            name: 'Test',
            slug: 'TestUpperCase' + Date.now(),
          },
        },
      });

      expect(status).toBe(201);
      expect(data.slug).toBe(data.slug.toLowerCase());

      createdProviderIds.push(data.id);
    });

    it('should reject duplicate slug', async () => {
      const slug = generateSlug('provider');

      const first = await apiRequest<TestProvider>('/api/settings/providers', {
        method: 'POST',
        body: { provider: { name: 'First', slug } },
      });
      createdProviderIds.push(first.data.id);

      const { status, data } = await apiRequest<{ error: string }>('/api/settings/providers', {
        method: 'POST',
        body: { provider: { name: 'Second', slug } },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('already exists');
    });

    it('should require name field', async () => {
      const { status, data } = await apiRequest<{ error: string }>('/api/settings/providers', {
        method: 'POST',
        body: { provider: { slug: 'test' } },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('name');
    });

    it('should require slug field', async () => {
      const { status, data } = await apiRequest<{ error: string }>('/api/settings/providers', {
        method: 'POST',
        body: { provider: { name: 'Test' } },
      });

      expect(status).toBe(400);
      expect(data.error).toContain('slug');
    });

    it('should reject invalid JSON', async () => {
      const response = await fetch('http://localhost:3002/api/settings/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid JSON');
    });
  });

  describe('GET /api/settings/providers/[id]', () => {
    it('should return a single provider with models', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const model = await createTestModel(provider.id);

      const { status, data } = await apiRequest<TestProvider & { models: unknown[] }>(
        `/api/settings/providers/${provider.id}`
      );

      expect(status).toBe(200);
      expect(data.id).toBe(provider.id);
      expect(data.name).toBe(provider.name);
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBe(1);
    });

    it('should return 404 for non-existent provider', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/providers/${fakeId}`
      );

      expect(status).toBe(404);
      expect(data.error).toBe('Provider not found');
    });
  });

  describe('PATCH /api/settings/providers/[id]', () => {
    it('should update provider name', async () => {
      const provider = await createTestProvider();
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<TestProvider>(
        `/api/settings/providers/${provider.id}`,
        {
          method: 'PATCH',
          body: { provider: { name: 'Updated Name' } },
        }
      );

      expect(status).toBe(200);
      expect(data.name).toBe('Updated Name');
    });

    it('should update provider enabled status', async () => {
      const provider = await createTestProvider({ enabled: true });
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<TestProvider>(
        `/api/settings/providers/${provider.id}`,
        {
          method: 'PATCH',
          body: { provider: { enabled: false } },
        }
      );

      expect(status).toBe(200);
      expect(data.enabled).toBe(false);
    });

    it('should update provider display_order', async () => {
      const provider = await createTestProvider({ display_order: 10 });
      createdProviderIds.push(provider.id);

      const { status, data } = await apiRequest<TestProvider>(
        `/api/settings/providers/${provider.id}`,
        {
          method: 'PATCH',
          body: { provider: { display_order: 50 } },
        }
      );

      expect(status).toBe(200);
      expect(data.display_order).toBe(50);
    });

    it('should reject duplicate slug on update', async () => {
      const provider1 = await createTestProvider();
      createdProviderIds.push(provider1.id);

      const provider2 = await createTestProvider();
      createdProviderIds.push(provider2.id);

      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/providers/${provider2.id}`,
        {
          method: 'PATCH',
          body: { provider: { slug: provider1.slug } },
        }
      );

      expect(status).toBe(400);
      expect(data.error).toContain('already exists');
    });

    it('should return 404 for non-existent provider', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/providers/${fakeId}`,
        {
          method: 'PATCH',
          body: { provider: { name: 'Test' } },
        }
      );

      expect(status).toBe(404);
      expect(data.error).toBe('Provider not found');
    });
  });

  describe('DELETE /api/settings/providers/[id]', () => {
    it('should delete a provider', async () => {
      const provider = await createTestProvider();

      const { status, data } = await apiRequest<{ success: boolean }>(
        `/api/settings/providers/${provider.id}`,
        { method: 'DELETE' }
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);

      const { status: getStatus } = await apiRequest(`/api/settings/providers/${provider.id}`);
      expect(getStatus).toBe(404);
    });

    it('should cascade delete associated models', async () => {
      const provider = await createTestProvider();
      const model = await createTestModel(provider.id);

      await apiRequest(`/api/settings/providers/${provider.id}`, { method: 'DELETE' });

      const { status } = await apiRequest(`/api/settings/models/${model.id}`);
      expect(status).toBe(404);
    });

    it('should return 404 for non-existent provider', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const { status, data } = await apiRequest<{ error: string }>(
        `/api/settings/providers/${fakeId}`,
        { method: 'DELETE' }
      );

      expect(status).toBe(404);
      expect(data.error).toBe('Provider not found');
    });
  });
});
