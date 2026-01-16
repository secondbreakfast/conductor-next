import { db, flows, prompts, runs } from '@/lib/db';
import { desc, eq, gte, and } from 'drizzle-orm';
import { Header } from '@/components/layout/header';
import { FlowsTable } from '@/components/flows/flows-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FlowsPage() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Fetch all flows
  const allFlows = await db
    .select()
    .from(flows)
    .orderBy(desc(flows.createdAt));

  // Fetch prompts and runs for each flow
  const transformedFlows = await Promise.all(
    allFlows.map(async (flow) => {
      // Get prompts count
      const flowPrompts = await db
        .select()
        .from(prompts)
        .where(eq(prompts.flowId, flow.id));

      // Get runs in last 24h
      const recentRuns = await db
        .select({ status: runs.status })
        .from(runs)
        .where(
          and(
            eq(runs.flowId, flow.id),
            gte(runs.createdAt, twentyFourHoursAgo)
          )
        );

      const successful24h = recentRuns.filter((r) => r.status === 'completed').length;
      const errors24h = recentRuns.filter((r) => r.status === 'failed').length;

      return {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        created_at: flow.createdAt?.toISOString() || new Date().toISOString(),
        prompts_count: flowPrompts.length,
        runs_24h: recentRuns.length,
        successful_24h: successful24h,
        errors_24h: errors24h,
      };
    })
  );

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

        <FlowsTable flows={transformedFlows} />
      </div>
    </div>
  );
}
