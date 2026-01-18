import { RunPromptParams, RunPromptResult } from '../index';
import { runVideoGemini } from './gemini';
import { db, media } from '@/lib/db';
import { eq, and } from 'drizzle-orm';

interface ImageToVideoItem {
  image_url: string;
  video_url?: string;
  regenerate?: boolean;
}

interface ImagesToVideosInput {
  items: ImageToVideoItem[];
}

export function extractMediaIdFromUrl(url: string): string | null {
  const match = url.match(/library\/([^.]+)\./);
  return match ? match[1] : null;
}

async function findExistingVideo(sourceImageId: string): Promise<{ id: string; url: string } | null> {
  const [existing] = await db
    .select({ id: media.id, url: media.url })
    .from(media)
    .where(and(eq(media.sourceImageId, sourceImageId), eq(media.type, 'video')));
  return existing || null;
}

export async function runImagesToVideos(params: RunPromptParams): Promise<RunPromptResult> {
  const { run } = params;
  const variables = (run.variables as Record<string, unknown>) || {};

  const input = variables as unknown as ImagesToVideosInput;
  if (!input.items || !Array.isArray(input.items)) {
    throw new Error('ImagesToVideos requires items array in variables');
  }

  const results = await Promise.all(
    input.items.map(async (item): Promise<{ url: string; mediaId: string }> => {
      if (item.video_url) {
        const videoId = extractMediaIdFromUrl(item.video_url);
        return { url: item.video_url, mediaId: videoId || '' };
      }

      const imageId = extractMediaIdFromUrl(item.image_url);
      if (!imageId) {
        throw new Error(`Could not extract media ID from URL: ${item.image_url}`);
      }

      if (!item.regenerate) {
        const existing = await findExistingVideo(imageId);
        if (existing) {
          return { url: existing.url, mediaId: existing.id };
        }
      }

      const videoResult = await runVideoGemini(
        {
          ...params,
          inputImageUrl: item.image_url,
        },
        { sourceImageId: imageId }
      );

      return {
        url: videoResult.outputUrl || videoResult.attachmentUrls?.[0] || '',
        mediaId: videoResult.outputMediaId || videoResult.outputMediaIds?.[0] || '',
      };
    })
  );

  const attachmentUrls = results.map((r) => r.url);
  const outputMediaIds = results.map((r) => r.mediaId);

  return {
    response: {
      status: 'complete',
      videoCount: results.length,
    },
    outputUrl: attachmentUrls[0],
    outputMediaId: outputMediaIds[0],
    outputType: 'video',
    attachmentUrls,
    outputMediaIds,
  };
}
