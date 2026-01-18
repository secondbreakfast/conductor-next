'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Edit,
  MoreHorizontal,
  Play,
  Trash2,
  Workflow,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface Flow {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string;
  prompts_count: number;
  runs_count: number;
}

interface FlowsGridProps {
  flows: Flow[];
}

export function FlowsGrid({ flows }: FlowsGridProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flow? This will also delete all associated prompts.')) {
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
    } catch (error) {
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {flows.map((flow) => (
        <Card key={flow.id} className="relative">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <Link href={`/flows/${flow.slug || flow.id}`}>
                <CardTitle className="text-lg hover:underline">
                  {flow.name}
                </CardTitle>
              </Link>
              {flow.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {flow.description}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/flows/${flow.slug || flow.id}`}>
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
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{flow.prompts_count} prompt{flow.prompts_count !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4 text-muted-foreground" />
                <span>{flow.runs_count} run{flow.runs_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Created {formatDistanceToNow(new Date(flow.created_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
