import { SupabaseClient } from '@supabase/supabase-js';
import { runChatOpenAI } from './chat/openai';
import { runChatAnthropic } from './chat/anthropic';
import { runChatGemini } from './chat/gemini';
import { runImageOpenAI } from './image/openai';
import { runImageGemini } from './image/gemini';
import { runImageStability } from './image/stability';
import { runVideoGemini } from './video/gemini';

export interface RunPromptParams {
  prompt: Record<string, unknown>;
  promptRun: Record<string, unknown>;
  run: Record<string, unknown>;
  inputImageUrl: string | null;
  supabase: SupabaseClient;
}

export interface RunPromptResult {
  response: Record<string, unknown>;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  };
  outputUrl?: string;
  outputType?: 'image' | 'video' | 'audio' | 'text';
  attachmentUrls?: string[];
  text?: string;
}

type RunnerFunction = (params: RunPromptParams) => Promise<RunPromptResult>;

// Map endpoint types and providers to runner functions
const runners: Record<string, Record<string, RunnerFunction>> = {
  Chat: {
    OpenAI: runChatOpenAI,
    Anthropic: runChatAnthropic,
    Gemini: runChatGemini,
  },
  ImageToImage: {
    OpenAI: runImageOpenAI,
    Gemini: runImageGemini,
    Stability: runImageStability,
  },
  ImageToVideo: {
    Gemini: runVideoGemini,
  },
  VideoToVideo: {
    // Rails ffmpeg concat - would need server-side implementation
  },
};

export async function runPrompt(params: RunPromptParams): Promise<RunPromptResult> {
  const { prompt } = params;
  const endpointType = prompt.endpoint_type as string;
  const provider = prompt.selected_provider as string;

  const runnerMap = runners[endpointType];
  if (!runnerMap) {
    throw new Error(`Unknown endpoint type: ${endpointType}`);
  }

  const runner = runnerMap[provider];
  if (!runner) {
    throw new Error(`Unknown provider ${provider} for endpoint ${endpointType}`);
  }

  return runner(params);
}

// Helper to render template variables in prompts using Mustache-style syntax
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  if (!template) return template;

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

// Helper to download image from URL and convert to base64
export async function imageUrlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

// Helper to get content type from URL
export function getContentTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return mimeTypes[extension || ''] || 'application/octet-stream';
}

// Helper to upload file to Supabase storage
export async function uploadToStorage(
  supabase: SupabaseClient,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const path = `outputs/${Date.now()}_${filename}`;

  const { error } = await supabase.storage
    .from('attachments')
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const { data: publicUrl } = supabase.storage
    .from('attachments')
    .getPublicUrl(path);

  return publicUrl.publicUrl;
}
