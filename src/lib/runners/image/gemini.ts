import { RunPromptParams, RunPromptResult, renderTemplate, imageUrlToBase64, getContentTypeFromUrl, uploadToStorage } from '../index';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

export async function runImageGemini(params: RunPromptParams): Promise<RunPromptResult> {
  const { prompt, run, inputImageUrl, supabase } = params;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const imagePrompt = renderTemplate(
    prompt.system_prompt as string || prompt.background_prompt as string || 'Generate an image',
    (run.variables as Record<string, unknown>) || {}
  );

  const model = (prompt.selected_model as string) || 'gemini-2.5-flash-image-preview';
  const url = `${GEMINI_API_URL}/models/${model}:generateContent?key=${apiKey}`;

  // Build parts array
  interface GeminiPart {
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }

  const parts: GeminiPart[] = [
    { text: imagePrompt },
  ];

  // Add input image if available
  if (inputImageUrl) {
    const base64 = await imageUrlToBase64(inputImageUrl);
    parts.push({
      inlineData: {
        mimeType: getContentTypeFromUrl(inputImageUrl),
        data: base64,
      },
    });
  }

  // Add attachment images (up to 4)
  const attachmentUrls = ((run.attachment_urls as string[]) || []).slice(0, 4);
  for (const attachmentUrl of attachmentUrls) {
    const base64 = await imageUrlToBase64(attachmentUrl);
    parts.push({
      inlineData: {
        mimeType: getContentTypeFromUrl(attachmentUrl),
        data: base64,
      },
    });
  }

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ['image', 'text'],
    },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract image from response
    const candidates = data.candidates || [];
    let outputUrl: string | undefined;
    let outputMediaId: string | undefined;
    const attachmentOutputUrls: string[] = [];
    const outputMediaIds: string[] = [];

    if (candidates.length > 0) {
      const content = candidates[0].content;
      if (content && content.parts) {
        for (const part of content.parts) {
          if (part.inlineData) {
            // Upload image to storage
            const buffer = Buffer.from(part.inlineData.data, 'base64');
            const extension = part.inlineData.mimeType.split('/')[1] || 'png';
            const filename = `gemini_${Date.now()}.${extension}`;
            const { url: uploadedUrl, mediaId } = await uploadToStorage(supabase, buffer, filename, part.inlineData.mimeType);

            if (!outputUrl) {
              outputUrl = uploadedUrl;
              outputMediaId = mediaId;
            }
            attachmentOutputUrls.push(uploadedUrl);
            outputMediaIds.push(mediaId);
          }
        }
      }
    }

    if (!outputUrl) {
      throw new Error('No image generated in response');
    }

    // Sanitize response - remove base64 data before storing
    const sanitizedResponse = JSON.parse(JSON.stringify(data));
    if (sanitizedResponse.candidates) {
      for (const candidate of sanitizedResponse.candidates) {
        if (candidate.content?.parts) {
          candidate.content.parts = candidate.content.parts.map((part: Record<string, unknown>) => {
            if (part.inlineData) {
              return { inlineData: { mimeType: (part.inlineData as Record<string, unknown>).mimeType, data: '[REDACTED]' } };
            }
            return part;
          });
        }
      }
    }

    return {
      response: sanitizedResponse,
      tokens: {
        input: data.usageMetadata?.promptTokenCount,
        output: data.usageMetadata?.candidatesTokenCount,
        total: data.usageMetadata?.totalTokenCount,
      },
      outputUrl,
      outputMediaId,
      outputType: 'image',
      attachmentUrls: attachmentOutputUrls,
      outputMediaIds,
    };
  } catch (error) {
    console.error('Gemini image error:', error);
    throw error;
  }
}
