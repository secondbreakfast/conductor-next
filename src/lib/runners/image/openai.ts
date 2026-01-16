import OpenAI from 'openai';
import { RunPromptParams, RunPromptResult, renderTemplate, uploadToStorage } from '../index';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Check if model is a GPT image model (gpt-image-1, gpt-image-1.5, etc.)
function isGptImageModel(model: string): boolean {
  return model.startsWith('gpt-image');
}

export async function runImageOpenAI(params: RunPromptParams): Promise<RunPromptResult> {
  const openai = getOpenAI();
  const { prompt, run, inputImageUrl, attachmentUrls, supabase } = params;

  const imagePrompt = renderTemplate(
    prompt.system_prompt as string || prompt.background_prompt as string || 'Generate an image',
    (run.variables as Record<string, unknown>) || {}
  );

  const model = (prompt.selected_model as string) || 'dall-e-3';
  const size = (prompt.size as '1024x1024' | '1024x1792' | '1792x1024') || '1024x1024';
  const quality = (prompt.quality as 'standard' | 'hd') || 'standard';

  try {
    // For gpt-image-1 and gpt-image-1.5
    if (isGptImageModel(model)) {
      // Collect all input images (from inputImageUrl and attachmentUrls)
      const allImageUrls: string[] = [];
      if (inputImageUrl) allImageUrls.push(inputImageUrl);
      if (attachmentUrls && attachmentUrls.length > 0) {
        allImageUrls.push(...attachmentUrls);
      }

      let response;

      if (allImageUrls.length > 0) {
        // Use images.edit() when we have input images
        // Download all images and convert to File objects
        const imageFiles: File[] = await Promise.all(
          allImageUrls.map(async (url, index) => {
            const res = await fetch(url);
            const buffer = Buffer.from(await res.arrayBuffer());
            // Determine content type from response or URL
            const contentType = res.headers.get('content-type') || 'image/png';
            const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
            return new File([buffer], `input_${index}.${ext}`, { type: contentType });
          })
        );

        // gpt-image models support up to 16 images
        const imagesToSend = imageFiles.slice(0, 16);

        response = await openai.images.edit({
          model,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          image: imagesToSend.length === 1 ? imagesToSend[0] : imagesToSend as any,
          prompt: imagePrompt,
          n: 1,
          size: size as '1024x1024' | '1536x1024' | '1024x1536' | 'auto',
        });
      } else {
        // Pure text-to-image generation
        response = await openai.images.generate({
          model,
          prompt: imagePrompt,
          n: 1,
          size: size as '1024x1024' | '1536x1024' | '1024x1536' | 'auto',
          quality,
        });
      }

      // gpt-image models return base64
      const imageData = response.data?.[0]?.b64_json;
      const imageUrl = response.data?.[0]?.url;

      let outputBuffer: Buffer;
      if (imageData) {
        outputBuffer = Buffer.from(imageData, 'base64');
      } else if (imageUrl) {
        const imageResponse = await fetch(imageUrl);
        outputBuffer = Buffer.from(await imageResponse.arrayBuffer());
      } else {
        throw new Error('No image data in response');
      }

      const filename = `openai_${Date.now()}.png`;
      const { url: outputUrl, mediaId } = await uploadToStorage(supabase, outputBuffer, filename, 'image/png');

      return {
        response: {
          created: response.created,
          model,
        },
        outputUrl,
        outputMediaId: mediaId,
        outputType: 'image',
        attachmentUrls: [outputUrl],
        outputMediaIds: [mediaId],
      };
    }

    // Legacy DALL-E models
    let response;
    let imageData: string | undefined;

    if (inputImageUrl && model === 'dall-e-2') {
      // Image edit mode - requires input image (only DALL-E 2 supports edit)
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
      // Image generation mode (DALL-E 3)
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
    const { url: outputUrl, mediaId } = await uploadToStorage(supabase, buffer, filename, 'image/png');

    return {
      response: {
        created: response.created,
        model,
      },
      outputUrl,
      outputMediaId: mediaId,
      outputType: 'image',
      attachmentUrls: [outputUrl],
      outputMediaIds: [mediaId],
    };
  } catch (error) {
    console.error('OpenAI image error:', error);
    throw error;
  }
}
