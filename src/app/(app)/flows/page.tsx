import { prisma } from '@/lib/prisma';
import { Header } from '@/components/layout/header';
import { FlowsTable } from '@/components/flows/flows-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FlowsPage() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const flows = await prisma.flows.findMany({
    orderBy: { created_at: 'desc' },
    include: {
      prompts: true,
      runs: {
        where: {
          created_at: {
            gte: twentyFourHoursAgo,
          },
        },
        select: {
          status: true,
        },
      },
    },
  });

  const transformedFlows = flows.map((flow) => {
    const runs24h = flow.runs;
    const successful24h = runs24h.filter((r) => r.status === 'completed').length;
    const errors24h = runs24h.filter((r) => r.status === 'failed').length;

    return {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      created_at: flow.created_at?.toISOString() || new Date().toISOString(),
      prompts_count: flow.prompts.length,
      runs_24h: runs24h.length,
      successful_24h: successful24h,
      errors_24h: errors24h,
    };
  });

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
