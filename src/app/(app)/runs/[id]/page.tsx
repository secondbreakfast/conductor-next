import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { RunDetail } from '@/components/runs/run-detail';
import { db, media } from '@/lib/db';
import { inArray } from 'drizzle-orm';

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run, error } = await supabase
    .from('runs')
    .select(
      `
      *,
      flow:flows(id, name, description),
      prompt_runs(
        *,
        prompt:prompts(
          id,
          endpoint_type,
          selected_provider,
          selected_model,
          system_prompt,
          background_prompt,
          foreground_prompt,
          negative_prompt,
          tools
        )
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !run) {
    notFound();
  }

  // Collect all media IDs that need to be fetched
  const allMediaIds: string[] = [];

  // Input media IDs from the run
  const inputMediaIds = (run.input_media_ids as string[]) || [];
  allMediaIds.push(...inputMediaIds);

  // Output media IDs from prompt runs
  const promptRuns = run.prompt_runs || [];
  for (const pr of promptRuns) {
    const prInputMediaIds = (pr.input_media_ids as string[]) || [];
    const prOutputMediaIds = (pr.output_media_ids as string[]) || [];
    allMediaIds.push(...prInputMediaIds, ...prOutputMediaIds);
  }

  // Fetch all media objects in one query
  let mediaMap: Record<string, typeof media.$inferSelect> = {};
  if (allMediaIds.length > 0) {
    const uniqueMediaIds = [...new Set(allMediaIds)];
    const mediaItems = await db
      .select()
      .from(media)
      .where(inArray(media.id, uniqueMediaIds));

    mediaMap = Object.fromEntries(mediaItems.map(m => [m.id, m]));
  }

  // Attach media objects to run
  const runWithMedia = {
    ...run,
    input_media: inputMediaIds.map(id => mediaMap[id]).filter(Boolean),
    prompt_runs: promptRuns.map((pr: Record<string, unknown>) => ({
      ...pr,
      input_media: ((pr.input_media_ids as string[]) || []).map(id => mediaMap[id]).filter(Boolean),
      output_media: ((pr.output_media_ids as string[]) || []).map(id => mediaMap[id]).filter(Boolean),
    })),
  };

  return (
    <div className="flex flex-col min-w-0 overflow-hidden">
      <Header title={`Run ${id.slice(0, 8)}...`} />
      <div className="flex-1 p-6 overflow-x-hidden">
        <RunDetail run={runWithMedia} />
      </div>
    </div>
  );
}
