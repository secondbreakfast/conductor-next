import { RunPromptParams, RunPromptResult, renderTemplate, uploadToStorage } from '../index';

const STABILITY_API_URL = 'https://api.stability.ai/v2beta';

interface StabilityGenerationResponse {
  id: string;
  status: 'pending' | 'complete' | 'failed';
  output?: Array<{
    image?: string;
    video?: string;
    finish_reason?: string;
  }>;
  finish_reason?: string;
}

export async function runImageStability(params: RunPromptParams): Promise<RunPromptResult> {
  const { prompt, run, inputImageUrl, supabase } = params;

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error('STABILITY_API_KEY environment variable is not set');
  }

  if (!inputImageUrl) {
    throw new Error('Input image URL is required for Stability AI');
  }

  const variables = (run.variables as Record<string, unknown>) || {};

  // Render prompts with variables
  const backgroundPrompt = renderTemplate(
    prompt.background_prompt as string || '',
    variables
  );
  const foregroundPrompt = renderTemplate(
    prompt.foreground_prompt as string || '',
    variables
  );
  const negativePrompt = renderTemplate(
    prompt.negative_prompt as string || '',
    variables
  );

  // Download and resize input image
  const imageResponse = await fetch(inputImageUrl);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

  // Create form data for the API request
  const formData = new FormData();

  // Add the input image
  formData.append('subject_image', new Blob([imageBuffer]), 'input.png');

  // Add optional parameters
  if (backgroundPrompt) {
    formData.append('background_prompt', backgroundPrompt);
  }
  if (foregroundPrompt) {
    formData.append('foreground_prompt', foregroundPrompt);
  }
  if (negativePrompt) {
    formData.append('negative_prompt', negativePrompt);
  }

  // Add numeric parameters if defined
  if (prompt.preserve_original_subject !== null && prompt.preserve_original_subject !== undefined) {
    formData.append('preserve_original_subject', String(prompt.preserve_original_subject));
  }
  if (prompt.original_background_depth !== null && prompt.original_background_depth !== undefined) {
    formData.append('original_background_depth', String(prompt.original_background_depth));
  }
  if (prompt.keep_original_background) {
    formData.append('keep_original_background', 'true');
  }
  if (prompt.light_source_direction) {
    formData.append('light_source_direction', prompt.light_source_direction as string);
  }
  if (prompt.light_source_strength !== null && prompt.light_source_strength !== undefined) {
    formData.append('light_source_strength', String(prompt.light_source_strength));
  }
  if (prompt.seed !== null && prompt.seed !== undefined) {
    formData.append('seed', String(Math.floor(prompt.seed as number)));
  }

  // Set output format
  const outputFormat = (prompt.output_format as string) || 'webp';
  formData.append('output_format', outputFormat);

  try {
    // Make request to Stability API
    const response = await fetch(`${STABILITY_API_URL}/stable-image/edit/replace-background-and-relight`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as StabilityGenerationResponse;

    // Check if generation is complete or needs polling
    if (data.id && data.status === 'pending') {
      // Need to poll for results
      const result = await pollForResult(apiKey, data.id, supabase, outputFormat);
      return result;
    }

    // Generation is complete
    if (data.output && data.output.length > 0) {
      const output = data.output[0];

      if (output.finish_reason === 'CONTENT_FILTERED') {
        throw new Error('Image was filtered due to content policy');
      }

      const imageData = output.image;
      if (!imageData) {
        throw new Error('No image data in response');
      }

      // Upload to storage
      const buffer = Buffer.from(imageData, 'base64');
      const extension = outputFormat;
      const filename = `stability_${Date.now()}.${extension}`;
      const mimeType = outputFormat === 'webp' ? 'image/webp' : `image/${outputFormat}`;
      const outputUrl = await uploadToStorage(supabase, buffer, filename, mimeType);

      return {
        response: {
          id: data.id,
          status: data.status,
          finish_reason: output.finish_reason,
        },
        outputUrl,
        outputType: 'image',
        attachmentUrls: [outputUrl],
      };
    }

    throw new Error('No output in Stability API response');
  } catch (error) {
    console.error('Stability image error:', error);
    throw error;
  }
}

async function pollForResult(
  apiKey: string,
  generationId: string,
  supabase: Parameters<typeof uploadToStorage>[0],
  outputFormat: string,
  maxAttempts = 60,
  intervalMs = 5000
): Promise<RunPromptResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before polling
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const response = await fetch(`${STABILITY_API_URL}/results/${generationId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Still processing
        continue;
      }
      const errorText = await response.text();
      throw new Error(`Stability polling error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as StabilityGenerationResponse;

    if (data.status === 'complete' && data.output && data.output.length > 0) {
      const output = data.output[0];

      if (output.finish_reason === 'CONTENT_FILTERED') {
        throw new Error('Image was filtered due to content policy');
      }

      const imageData = output.image || output.video;
      if (!imageData) {
        throw new Error('No output data in response');
      }

      // Determine output type
      const isVideo = !!output.video;
      const extension = isVideo ? 'mp4' : outputFormat;
      const mimeType = isVideo ? 'video/mp4' : (outputFormat === 'webp' ? 'image/webp' : `image/${outputFormat}`);

      // Upload to storage
      const buffer = Buffer.from(imageData, 'base64');
      const filename = `stability_${Date.now()}.${extension}`;
      const outputUrl = await uploadToStorage(supabase, buffer, filename, mimeType);

      return {
        response: {
          id: generationId,
          status: 'complete',
          finish_reason: output.finish_reason,
        },
        outputUrl,
        outputType: isVideo ? 'video' : 'image',
        attachmentUrls: [outputUrl],
      };
    }

    if (data.status === 'failed') {
      throw new Error('Stability generation failed');
    }
  }

  throw new Error('Stability generation timed out');
}
