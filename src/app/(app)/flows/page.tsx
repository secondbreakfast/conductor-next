import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { FlowsGrid } from '@/components/flows/flows-grid';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function FlowsPage() {
  const supabase = await createClient();

  const { data: flows, error } = await supabase
    .from('flows')
    .select(
      `
      *,
      prompts(count),
      runs(count)
    `
    )
    .order('created_at', { ascending: false });

  // Transform to add counts
  const transformedFlows = flows?.map((flow) => ({
    ...flow,
    prompts_count: Array.isArray(flow.prompts)
      ? flow.prompts.length
      : (flow.prompts as { count: number })?.count || 0,
    runs_count: Array.isArray(flow.runs)
      ? flow.runs.length
      : (flow.runs as { count: number })?.count || 0,
  }));

  return (
    <div className="flex flex-col">
      <Header title="Flows" />
      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              Create and manage your image processing workflows
            </p>
          </div>
          <Link href="/flows/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Flow
            </Button>
          </Link>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
            <p className="text-destructive">Error loading flows: {error.message}</p>
          </div>
        ) : (
          <FlowsGrid flows={transformedFlows || []} />
        )}
      </div>
    </div>
  );
}
