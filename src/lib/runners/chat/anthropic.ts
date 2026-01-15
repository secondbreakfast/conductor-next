import Anthropic from '@anthropic-ai/sdk';
import { RunPromptParams, RunPromptResult, renderTemplate, imageUrlToBase64, getContentTypeFromUrl } from '../index';

function getAnthropic() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export async function runChatAnthropic(params: RunPromptParams): Promise<RunPromptResult> {
  const anthropic = getAnthropic();
  const { prompt, run, inputImageUrl } = params;

  const systemPrompt = renderTemplate(
    prompt.system_prompt as string || '',
    (run.variables as Record<string, unknown>) || {}
  );

  const content: Anthropic.MessageParam['content'] = [];

  // Add text message if present
  if (run.message) {
    content.push({ type: 'text', text: run.message as string });
  }

  // Add input image if available
  if (inputImageUrl) {
    const base64 = await imageUrlToBase64(inputImageUrl);
    const mediaType = getContentTypeFromUrl(inputImageUrl) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    });
  }

  // Add attachment images
  const attachmentUrls = (run.attachment_urls as string[]) || [];
  for (const url of attachmentUrls) {
    const base64 = await imageUrlToBase64(url);
    const mediaType = getContentTypeFromUrl(url) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      },
    });
  }

  // Ensure we have content
  if (content.length === 0) {
    content.push({ type: 'text', text: 'Hello' });
  }

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content },
  ];

  // Prepare tools if defined
  const promptTools = (prompt.tools as Array<Record<string, unknown>>) || [];
  const tools: Anthropic.Tool[] | undefined = promptTools.length > 0
    ? promptTools.map((tool) => ({
        name: tool.name as string,
        description: tool.description as string,
        input_schema: tool.parameters as Anthropic.Tool.InputSchema,
      }))
    : undefined;

  try {
    const message = await anthropic.messages.create({
      model: (prompt.selected_model as string) || 'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      system: systemPrompt || undefined,
      messages,
      tools,
    });

    // Extract text from content blocks
    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        text += block.text;
      }
    }

    return {
      response: {
        id: message.id,
        model: message.model,
        content: message.content,
        usage: message.usage,
        stop_reason: message.stop_reason,
      },
      tokens: {
        input: message.usage?.input_tokens,
        output: message.usage?.output_tokens,
        total: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
      },
      text: text || undefined,
    };
  } catch (error) {
    console.error('Anthropic chat error:', error);
    throw error;
  }
}
