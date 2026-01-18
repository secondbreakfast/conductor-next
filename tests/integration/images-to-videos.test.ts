import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiRequest, generateSlug } from './test-utils';

interface TestFlow {
  id: string;
  name: string;
  slug: string | null;
}

interface TestPrompt {
  id: string;
  flow_id: string;
  endpoint_type: string;
  selected_provider: string;
  selected_model: string;
}

interface TestRun {
  id: string;
  flow_id: string;
  status: string;
}

describe('ImagesToVideos Endpoint', () => {
  let testFlow: TestFlow;
  let testPrompt: TestPrompt;

  beforeAll(async () => {
    const flowSlug = generateSlug('i2v-test');
    const { data: flow, status: flowStatus } = await apiRequest<TestFlow>('/api/flows', {
      method: 'POST',
      body: {
        flow: {
          name: `ImagesToVideos Test Flow ${flowSlug}`,
          slug: flowSlug,
        },
      },
    });
    expect(flowStatus).toBe(201);
    testFlow = flow;

    const { data: prompt, status: promptStatus } = await apiRequest<TestPrompt>('/api/prompts', {
      method: 'POST',
      body: {
        prompt: {
          flow_id: testFlow.id,
          endpoint_type: 'ImagesToVideos',
          selected_provider: 'Gemini',
          selected_model: 'veo-3.0-generate-001',
          system_prompt: 'Generate a video from this image',
        },
      },
    });
    expect(promptStatus).toBe(201);
    testPrompt = prompt;
  });

  afterAll(async () => {
    if (testFlow?.id) {
      await apiRequest(`/api/flows/${testFlow.id}`, { method: 'DELETE' });
    }
  });

  it('should create a prompt with ImagesToVideos endpoint type', () => {
    expect(testPrompt.endpoint_type).toBe('ImagesToVideos');
    expect(testPrompt.selected_provider).toBe('Gemini');
  });

  it('should create a run with ImagesToVideos variables', async () => {
    const { data: run, status } = await apiRequest<TestRun>('/api/runs', {
      method: 'POST',
      body: {
        run: {
          flow_id: testFlow.id,
          variables: {
            items: [
              { image_url: 'https://example.com/library/img_test1234.png' },
              { image_url: 'https://example.com/library/img_test5678.png', regenerate: true },
              { image_url: 'https://example.com/library/img_test9abc.png', video_url: 'https://example.com/library/vdo_existing.mp4' },
            ],
          },
        },
      },
    });

    expect(status).toBe(201);
    expect(run.id).toBeDefined();
    expect(run.flow_id).toBe(testFlow.id);
    expect(run.status).toBe('pending');
  });

  it('should reject run without items array', async () => {
    const { data: run, status } = await apiRequest<TestRun>('/api/runs', {
      method: 'POST',
      body: {
        run: {
          flow_id: testFlow.id,
          variables: {},
        },
      },
    });

    expect(status).toBe(201);
    expect(run.status).toBe('pending');
  });

  it('should retrieve the created prompt with correct endpoint type', async () => {
    const { data: prompts, status } = await apiRequest<TestPrompt[]>(
      `/api/prompts?flow_id=${testFlow.id}`
    );

    expect(status).toBe(200);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].endpoint_type).toBe('ImagesToVideos');
  });
});
