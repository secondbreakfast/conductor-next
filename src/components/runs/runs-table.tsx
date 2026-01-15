'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, MoreHorizontal, RefreshCw, Trash2, Image, Video } from 'lucide-react';
import { RunStatus, TOKEN_PRICING } from '@/types/database';

interface PromptRun {
  id: string;
  status: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  selected_provider: string | null;
  model: string | null;
}

interface RunWithDetails {
  id: string;
  flow_id: string;
  status: RunStatus;
  message: string | null;
  input_image_url: string | null;
  webhook_url: string | null;
  conversation_id: string | null;
  variables: Record<string, unknown>;
  attachment_urls: string[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  data: {
    image_url?: string;
    video_url?: string;
    text?: string;
    [key: string]: unknown;
  };
  flow?: { id: string; name: string } | null;
  prompt_runs?: PromptRun[];
}

interface RunsTableProps {
  runs: RunWithDetails[];
}

const statusColors: Record<RunStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  'timed-out': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export function RunsTable({ runs }: RunsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this run?')) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/runs/${id}`, { method: 'DELETE' });
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting run:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const calculateCost = (promptRuns?: PromptRun[]): string => {
    if (!promptRuns || promptRuns.length === 0) return '-';

    let totalCost = 0;
    for (const pr of promptRuns) {
      const model = pr.model || '';
      const pricing = TOKEN_PRICING[model];
      if (pricing && pr.input_tokens && pr.output_tokens) {
        totalCost +=
          (pr.input_tokens / 1000) * pricing.input +
          (pr.output_tokens / 1000) * pricing.output;
      }
    }

    if (totalCost === 0) return '-';
    return `$${totalCost.toFixed(4)}`;
  };

  const getTotalTokens = (promptRuns?: PromptRun[]): number => {
    if (!promptRuns) return 0;
    return promptRuns.reduce((sum, pr) => sum + (pr.total_tokens || 0), 0);
  };

  const getOutputType = (data: RunWithDetails['data']): 'image' | 'video' | null => {
    if (data?.video_url) return 'video';
    if (data?.image_url) return 'image';
    return null;
  };

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <p className="text-lg font-medium">No runs found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new run to get started
        </p>
        <Link href="/runs/new" className="mt-4">
          <Button>Create Run</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Type</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Flow</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tokens</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                {getOutputType(run.data) === 'video' ? (
                  <Video className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Image className="h-4 w-4 text-muted-foreground" />
                )}
              </TableCell>
              <TableCell className="font-mono text-sm">
                <Link
                  href={`/runs/${run.id}`}
                  className="hover:underline"
                >
                  {run.id.slice(0, 8)}...
                </Link>
              </TableCell>
              <TableCell>
                {run.flow ? (
                  <Link
                    href={`/flows/${run.flow.id}`}
                    className="hover:underline"
                  >
                    {run.flow.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={statusColors[run.status as RunStatus]}
                >
                  {run.status}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {getTotalTokens(run.prompt_runs) > 0
                  ? getTotalTokens(run.prompt_runs).toLocaleString()
                  : '-'}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {calculateCost(run.prompt_runs)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(run.created_at), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Link href={`/runs/${run.id}`}>
                      <DropdownMenuItem>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                    </Link>
                    {run.status === 'failed' && (
                      <DropdownMenuItem>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(run.id)}
                      disabled={deletingId === run.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
