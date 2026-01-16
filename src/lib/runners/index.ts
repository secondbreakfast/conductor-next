import { SupabaseClient } from '@supabase/supabase-js';
import { runChatOpenAI } from './chat/openai';
import { runChatAnthropic } from './chat/anthropic';
import { runChatGemini } from './chat/gemini';
import { runImageOpenAI } from './image/openai';
import { runImageGemini } from './image/gemini';
import { runImageStability } from './image/stability';
import { runVideoGemini } from './video/gemini';
import { db, media } from '@/lib/db';

export interface RunPromptParams {
  prompt: Record<string, unknown>;
  promptRun: Record<string, unknown>;
  run: Record<string, unknown>;
  inputImageUrl: string | null;
  attachmentUrls?: string[];
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
  outputMediaId?: string;
  outputType?: 'image' | 'video' | 'audio' | 'text';
  attachmentUrls?: string[];
  outputMediaIds?: string[];
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

// Generate custom ID: img_xxxxxxxx or vdo_xxxxxxxx
function generateMediaId(type: 'image' | 'video'): string {
  const prefix = type === 'image' ? 'img' : 'vdo';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${id}`;
}

export interface UploadResult {
  url: string;
  mediaId: string;
}

// Helper to upload file to Supabase storage and create media record
export async function uploadToStorage(
  supabase: SupabaseClient,
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const isVideo = contentType.startsWith('video/');
  const type = isVideo ? 'video' : 'image';
  const mediaId = generateMediaId(type);

  // Get file extension
  const ext = filename.split('.').pop() || (isVideo ? 'mp4' : 'png');
  const storageName = `${mediaId}.${ext}`;
  const path = `library/${storageName}`;

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

  const url = publicUrl.publicUrl;

  // Create media record in database
  await db.insert(media).values({
    id: mediaId,
    type,
    filename,
    url,
    mimeType: contentType,
    size: buffer.length,
  });

  return { url, mediaId };
}
