import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { RunsTable } from '@/components/runs/runs-table';
import { RunsFilters } from '@/components/runs/runs-filters';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    flow_id?: string;
    sort_by?: string;
    sort_order?: string;
  }>;
}) {
  return (
    <div className="flex flex-col">
      <Header title="Runs" />
      <div className="flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-muted-foreground">
              View and manage your image processing runs
            </p>
          </div>
          <Link href="/runs/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Run
            </Button>
          </Link>
        </div>

        <Suspense fallback={<RunsFilters />}>
          <RunsFiltersWrapper searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<RunsTableSkeleton />}>
          <RunsTableWrapper searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function RunsFiltersWrapper({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    flow_id?: string;
    sort_by?: string;
    sort_order?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // Fetch flows for filter dropdown
  const { data: flows } = await supabase
    .from('flows')
    .select('id, name')
    .order('name');

  return <RunsFilters flows={flows || []} initialParams={params} />;
}

async function RunsTableWrapper({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    flow_id?: string;
    sort_by?: string;
    sort_order?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('runs')
    .select(
      `
      *,
      flow:flows(id, name),
      prompt_runs(
        id,
        status,
        input_tokens,
        output_tokens,
        total_tokens,
        selected_provider,
        model
      )
    `
    )
    .order(params.sort_by || 'created_at', {
      ascending: params.sort_order === 'asc',
    })
    .limit(50);

  if (params.status) {
    query = query.eq('status', params.status);
  }
  if (params.flow_id) {
    query = query.eq('flow_id', params.flow_id);
  }

  const { data: runs, error } = await query;

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
        <p className="text-destructive">Error loading runs: {error.message}</p>
      </div>
    );
  }

  return <RunsTable runs={runs || []} />;
}

function RunsTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full" />
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
