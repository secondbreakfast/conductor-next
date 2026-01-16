'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Edit, MoreHorizontal, Play, Trash2, Workflow } from 'lucide-react';
import { toast } from 'sonner';

interface Flow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  prompts_count: number;
  runs_24h: number;
  successful_24h: number;
  errors_24h: number;
}

interface FlowsTableProps {
  flows: Flow[];
}

export function FlowsTable({ flows }: FlowsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this flow? This will also delete all associated prompts.'
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/flows/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Flow deleted');
        window.location.reload();
      } else {
        toast.error('Failed to delete flow');
      }
    } catch {
      toast.error('Failed to delete flow');
    } finally {
      setDeletingId(null);
    }
  };

  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <Workflow className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">No flows found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new flow to define your image processing pipeline
        </p>
        <Link href="/flows/new" className="mt-4">
          <Button>Create Flow</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Prompts</TableHead>
            <TableHead className="text-center">Runs (24h)</TableHead>
            <TableHead className="text-center">Successful</TableHead>
            <TableHead className="text-center">Errors</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flows.map((flow) => (
            <TableRow key={flow.id}>
              <TableCell>
                <Link
                  href={`/flows/${flow.id}`}
                  className="font-medium hover:underline"
                >
                  {flow.name}
                </Link>
                {flow.description && (
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {flow.description}
                  </p>
                )}
              </TableCell>
              <TableCell>{flow.prompts_count}</TableCell>
              <TableCell className="text-center">{flow.runs_24h}</TableCell>
              <TableCell className="text-center">
                {flow.successful_24h > 0 ? (
                  <span className="text-green-600">{flow.successful_24h}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {flow.errors_24h > 0 ? (
                  <span className="text-red-600">{flow.errors_24h}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(flow.created_at), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Link href={`/flows/${flow.id}`}>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                    </Link>
                    <Link href={`/runs/new?flow_id=${flow.id}`}>
                      <DropdownMenuItem>
                        <Play className="mr-2 h-4 w-4" />
                        Run
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(flow.id)}
                      disabled={deletingId === flow.id}
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
