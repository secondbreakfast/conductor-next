// Database types for Supabase

export type FlowStatus = 'active' | 'inactive';
export type RunStatus = 'pending' | 'completed' | 'failed' | 'timed-out';
export type PromptRunStatus = 'pending' | 'completed' | 'failed';
export type WebhookStatus = 'pending' | 'delivered' | 'failed';

export type EndpointType =
  | 'Chat'
  | 'ImageToImage'
  | 'ImageToVideo'
  | 'ImagesToVideos'
  | 'VideoToVideo'
  | 'AudioToText'
  | 'TextToAudio';

export type Provider =
  | 'OpenAI'
  | 'Stability'
  | 'Replicate'
  | 'Anthropic'
  | 'Gemini'
  | 'Rails';

// ============================================================================
// CONFIGURABLE MODELS - Database Types
// ============================================================================

export interface ProviderRecord {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  models?: ModelRecord[];
  models_count?: number;
  enabled_models_count?: number;
}

export interface ModelRecord {
  id: string;
  provider_id: string;
  provider?: ProviderRecord;
  name: string;
  model_id: string;
  endpoint_types: EndpointType[];
  enabled: boolean;
  display_order: number;
  default_params: ModelDefaultParams;
  input_price: number | null;
  output_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ModelDefaultParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  size?: string;
  quality?: string;
  style?: string;
  [key: string]: unknown;
}

export interface ModelOption {
  id: string;
  provider: { id: string; name: string; slug: string };
  name: string;
  model_id: string;
  default_params: ModelDefaultParams;
}

// ============================================================================
// LEGACY CONSTANTS - Deprecated
// ============================================================================

/**
 * @deprecated Use database-driven models via /api/models endpoint.
 * These constants remain for backward compatibility during transition.
 */
export const CHAT_MODELS = {
  OpenAI: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'gpt-4o-2024-08-06'],
  Anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-7-sonnet'],
  Gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-3-flash-preview'],
} as const;

/**
 * @deprecated Use database-driven models via /api/models endpoint.
 * These constants remain for backward compatibility during transition.
 */
export const IMAGE_MODELS = {
  OpenAI: ['gpt-image-1', 'gpt-image-1.5', 'dall-e-3', 'dall-e-2'],
  Gemini: ['gemini-2.5-flash-image-preview', 'gemini-3-pro-image-preview'],
  Stability: ['remove-background', 'replace-background-and-relight'],
} as const;

/**
 * @deprecated Use database-driven models via /api/models endpoint.
 * These constants remain for backward compatibility during transition.
 */
export const VIDEO_MODELS = {
  Gemini: ['veo-3.0-generate-001'],
  Rails: ['ffmpeg-concat'],
} as const;

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Flow {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields for UI
  prompts?: Prompt[];
  runs_count?: number;
}

export interface Prompt {
  id: string;
  flow_id: string;
  type: string;
  action: string | null;
  endpoint_type: EndpointType;
  selected_provider: Provider;
  selected_model: string;
  // Chat configuration
  system_prompt: string | null;
  tools: Record<string, unknown>[] | null;
  // Image configuration
  background_prompt: string | null;
  foreground_prompt: string | null;
  negative_prompt: string | null;
  preserve_original_subject: number | null;
  original_background_depth: number | null;
  keep_original_background: boolean;
  light_source_direction: string | null;
  light_source_strength: number | null;
  seed: number | null;
  output_format: string | null;
  size: string | null;
  quality: string | null;
  // Video configuration
  video_duration: number | null;
  // Attachments (stored as URLs in Supabase)
  subject_image_url: string | null;
  background_reference_url: string | null;
  attachment_urls: string[];
  created_at: string;
  updated_at: string;
  // Virtual
  flow?: Flow;
}

export interface Run {
  id: string;
  flow_id: string;
  source_run_id: string | null;
  status: RunStatus;
  message: string | null;
  webhook_url: string | null;
  conversation_id: string | null;
  variables: Record<string, unknown>;
  attachment_urls: string[];
  input_media_ids: string[]; // Array of media IDs for inputs
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Output data
  data: {
    image_url?: string;
    video_url?: string;
    text?: string;
    [key: string]: unknown;
  };
  // Virtual fields
  flow?: Flow;
  prompt_runs?: PromptRun[];
  input_media?: Media[]; // Populated media objects
  url?: string;
}

export interface PromptRun {
  id: string;
  prompt_id: string;
  run_id: string;
  status: PromptRunStatus;
  response: Record<string, unknown> | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  selected_provider: string | null;
  model: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Output attachments
  source_attachment_urls: string[];
  attachment_urls: string[];
  input_media_ids: string[]; // Array of media IDs for inputs
  output_media_ids: string[]; // Array of media IDs for outputs
  // Virtual
  prompt?: Prompt;
  run?: Run;
  responses?: Response[];
  input_media?: Media[]; // Populated media objects
  output_media?: Media[]; // Populated media objects
}

export interface Response {
  id: string;
  prompt_run_id: string;
  provider_id: string | null;
  role: string;
  response_type: string | null;
  status: string | null;
  call_id: string | null;
  name: string | null;
  arguments: string | null;
  created_at: string;
  updated_at: string;
  // Virtual
  outputs?: Output[];
}

export interface Output {
  id: string;
  response_id: string;
  provider_id: string | null;
  text: string | null;
  content_type: string | null;
  annotations: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunWebhook {
  id: string;
  run_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: WebhookStatus;
  attempt_count: number;
  last_attempted_at: string | null;
  error_message: string | null;
  endpoint_url: string;
  created_at: string;
  updated_at: string;
}

export interface Media {
  id: string; // img_xxxxxxxx or vdo_xxxxxxxx
  type: 'image' | 'video';
  filename: string;
  url: string;
  mime_type: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null; // seconds, for videos
  source_image_id: string | null; // tracks image→video relationship
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  // Virtual
  runs?: Run[];
}

// API request/response types
export interface CreateRunRequest {
  run: {
    flow_id: string | number;
    message?: string;
    webhook_url?: string;
    variables?: Record<string, unknown>;
    attachment_urls?: string[];
    conversation_id?: string;
  };
}

export interface RunResponse {
  id: string;
  flow_id: string;
  status: RunStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  data: {
    image_url?: string;
    video_url?: string;
    [key: string]: unknown;
  };
  url: string;
}

export interface WebhookPayload {
  type: string;
  data: {
    object: RunResponse;
  };
  created: number;
}

/**
 * @deprecated Use database-driven pricing via Model.input_price/output_price.
 * Token pricing (approximate USD per 1K tokens)
 */
export const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4.1': { input: 0.002, output: 0.008 },
  'gpt-4.1-mini': { input: 0.0004, output: 0.0016 },
  'gpt-4.1-nano': { input: 0.0001, output: 0.0004 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-7-sonnet': { input: 0.003, output: 0.015 },
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
};
