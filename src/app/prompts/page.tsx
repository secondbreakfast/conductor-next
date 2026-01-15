import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { PromptsTable } from '@/components/prompts/prompts-table';

export default async function PromptsPage() {
  const supabase = await createClient();

  const { data: prompts, error } = await supabase
    .from('prompts')
    .select(
      `
      *,
      flow:flows(id, name)
    `
    )
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col">
      <Header title="Prompts" />
      <div className="flex-1 p-6">
        <div className="mb-6">
          <p className="text-muted-foreground">
            View all prompts across your flows
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-destructive">Error loading prompts: {error.message}</p>
          </div>
        ) : (
          <PromptsTable prompts={prompts || []} />
        )}
      </div>
    </div>
  );
}
