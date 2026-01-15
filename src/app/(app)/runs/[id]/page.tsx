import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { RunDetail } from '@/components/runs/run-detail';

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

  return (
    <div className="flex flex-col">
      <Header title={`Run ${id.slice(0, 8)}...`} />
      <div className="flex-1 p-6">
        <RunDetail run={run} />
      </div>
    </div>
  );
}
