import OpenAI from 'openai';
import { RunPromptParams, RunPromptResult, renderTemplate, uploadToStorage } from '../index';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function runImageOpenAI(params: RunPromptParams): Promise<RunPromptResult> {
  const openai = getOpenAI();
  const { prompt, run, inputImageUrl, supabase } = params;

  const imagePrompt = renderTemplate(
    prompt.system_prompt as string || prompt.background_prompt as string || 'Generate an image',
    (run.variables as Record<string, unknown>) || {}
  );

  const model = (prompt.selected_model as string) || 'dall-e-3';
  const size = (prompt.size as '1024x1024' | '1024x1792' | '1792x1024') || '1024x1024';
  const quality = (prompt.quality as 'standard' | 'hd') || 'standard';

  try {
    let response;
    let imageData: string | undefined;

    if (inputImageUrl && (model === 'dall-e-2' || model === 'gpt-image-1' || model === 'gpt-image-1.5')) {
      // Image edit mode - requires input image
      const imageResponse = await fetch(inputImageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Create a File-like object for the API
      const file = new File([imageBuffer], 'input.png', { type: 'image/png' });

      response = await openai.images.edit({
        image: file,
        prompt: imagePrompt,
        n: 1,
        size: size === '1792x1024' || size === '1024x1792' ? '1024x1024' : size,
        response_format: 'b64_json',
      });

      imageData = response.data?.[0]?.b64_json;
    } else {
      // Image generation mode
      response = await openai.images.generate({
        model,
        prompt: imagePrompt,
        n: 1,
        size,
        quality,
        response_format: 'b64_json',
      });

      imageData = response.data?.[0]?.b64_json;
    }

    if (!imageData) {
      throw new Error('No image data in response');
    }

    // Upload image to Supabase storage
    const buffer = Buffer.from(imageData, 'base64');
    const filename = `openai_${Date.now()}.png`;
    const outputUrl = await uploadToStorage(supabase, buffer, filename, 'image/png');

    return {
      response: {
        created: response.created,
        model,
      },
      outputUrl,
      outputType: 'image',
      attachmentUrls: [outputUrl],
    };
  } catch (error) {
    console.error('OpenAI image error:', error);
    throw error;
  }
}
