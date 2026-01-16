import { notFound } from 'next/navigation';
import { db, media } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { MediaDetail } from '@/components/library/media-detail';

export interface MediaUsage {
  asInput: Array<{
    run: {
      id: string;
      status: string;
      created_at: string;
      flow?: { id: string; name: string } | null;
    };
  }>;
  asOutput: Array<{
    run: {
      id: string;
      status: string;
      created_at: string;
      flow?: { id: string; name: string } | null;
    };
    promptRun: {
      id: string;
      prompt?: {
        id: string;
        endpoint_type: string;
        selected_provider: string;
        selected_model: string;
      } | null;
    };
  }>;
}

export default async function MediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [item] = await db
    .select()
    .from(media)
    .where(eq(media.id, id));

  if (!item) {
    notFound();
  }

  // Query for runs that used this media as input
  const supabase = await createClient();

  const { data: runsAsInput } = await supabase
    .from('runs')
    .select(`
      id,
      status,
      created_at,
      flow:flows(id, name)
    `)
    .contains('input_media_ids', [id])
    .order('created_at', { ascending: false })
    .limit(20);

  // Query for prompt_runs that generated this media as output
  const { data: promptRunsAsOutput } = await supabase
    .from('prompt_runs')
    .select(`
      id,
      run:runs(
        id,
        status,
        created_at,
        flow:flows(id, name)
      ),
      prompt:prompts(
        id,
        endpoint_type,
        selected_provider,
        selected_model
      )
    `)
    .contains('output_media_ids', [id])
    .order('created_at', { ascending: false })
    .limit(20);

  const usage: MediaUsage = {
    asInput: (runsAsInput || []).map((r) => ({
      run: {
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        flow: Array.isArray(r.flow) ? r.flow[0] : r.flow,
      },
    })),
    asOutput: (promptRunsAsOutput || []).map((pr) => {
      const run = Array.isArray(pr.run) ? pr.run[0] : pr.run;
      return {
        run: {
          id: run?.id,
          status: run?.status,
          created_at: run?.created_at,
          flow: Array.isArray(run?.flow) ? run?.flow[0] : run?.flow,
        },
        promptRun: {
          id: pr.id,
          prompt: Array.isArray(pr.prompt) ? pr.prompt[0] : pr.prompt,
        },
      };
    }),
  };

  return <MediaDetail media={item} usage={usage} />;
}
