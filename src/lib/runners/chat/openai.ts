import OpenAI from 'openai';
import { RunPromptParams, RunPromptResult, renderTemplate } from '../index';

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function runChatOpenAI(params: RunPromptParams): Promise<RunPromptResult> {
  const openai = getOpenAI();
  const { prompt, run, inputImageUrl } = params;

  const systemPrompt = renderTemplate(
    prompt.system_prompt as string || '',
    (run.variables as Record<string, unknown>) || {}
  );

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  // Add system message
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Build user message with optional image
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

  if (run.message) {
    userContent.push({ type: 'text', text: run.message as string });
  }

  // Add input image if available
  if (inputImageUrl) {
    userContent.push({
      type: 'image_url',
      image_url: { url: inputImageUrl },
    });
  }

  // Add attachment images
  const attachmentUrls = (run.attachment_urls as string[]) || [];
  for (const url of attachmentUrls) {
    userContent.push({
      type: 'image_url',
      image_url: { url },
    });
  }

  if (userContent.length > 0) {
    messages.push({ role: 'user', content: userContent });
  }

  // Prepare tools if defined
  const tools = (prompt.tools as OpenAI.Chat.Completions.ChatCompletionTool[]) || undefined;

  try {
    const completion = await openai.chat.completions.create({
      model: (prompt.selected_model as string) || 'gpt-4o',
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      max_tokens: 4096,
    });

    const choice = completion.choices[0];
    const message = choice?.message;

    return {
      response: {
        id: completion.id,
        model: completion.model,
        choices: completion.choices,
        usage: completion.usage,
      },
      tokens: {
        input: completion.usage?.prompt_tokens,
        output: completion.usage?.completion_tokens,
        total: completion.usage?.total_tokens,
      },
      text: message?.content || undefined,
    };
  } catch (error) {
    console.error('OpenAI chat error:', error);
    throw error;
  }
}
