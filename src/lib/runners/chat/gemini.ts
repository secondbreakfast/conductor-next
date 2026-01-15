import { RunPromptParams, RunPromptResult, renderTemplate, imageUrlToBase64, getContentTypeFromUrl } from '../index';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

export async function runChatGemini(params: RunPromptParams): Promise<RunPromptResult> {
  const { prompt, run, inputImageUrl } = params;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const systemPrompt = renderTemplate(
    prompt.system_prompt as string || '',
    (run.variables as Record<string, unknown>) || {}
  );

  const parts: GeminiPart[] = [];

  // Add text message if present
  if (run.message) {
    parts.push({ text: run.message as string });
  }

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

  // Add attachment images
  const attachmentUrls = (run.attachment_urls as string[]) || [];
  for (const url of attachmentUrls) {
    const base64 = await imageUrlToBase64(url);
    parts.push({
      inlineData: {
        mimeType: getContentTypeFromUrl(url),
        data: base64,
      },
    });
  }

  // Ensure we have content
  if (parts.length === 0) {
    parts.push({ text: 'Hello' });
  }

  const contents: GeminiContent[] = [
    { role: 'user', parts },
  ];

  // Prepare tools if defined
  const promptTools = (prompt.tools as Array<Record<string, unknown>>) || [];
  const tools = promptTools.length > 0
    ? {
        functionDeclarations: promptTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      }
    : undefined;

  const model = (prompt.selected_model as string) || 'gemini-2.5-flash';
  const url = `${GEMINI_API_URL}/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: 4096,
    },
  };

  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (tools) {
    requestBody.tools = [tools];
  }

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

    // Extract text from response
    let text = '';
    const candidates = data.candidates || [];
    if (candidates.length > 0) {
      const content = candidates[0].content;
      if (content && content.parts) {
        for (const part of content.parts) {
          if (part.text) {
            text += part.text;
          }
        }
      }
    }

    // Extract usage metadata
    const usageMetadata = data.usageMetadata || {};

    return {
      response: {
        candidates: data.candidates,
        usageMetadata: data.usageMetadata,
        modelVersion: data.modelVersion,
      },
      tokens: {
        input: usageMetadata.promptTokenCount,
        output: usageMetadata.candidatesTokenCount,
        total: usageMetadata.totalTokenCount,
      },
      text: text || undefined,
    };
  } catch (error) {
    console.error('Gemini chat error:', error);
    throw error;
  }
}
