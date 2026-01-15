'use client';

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
import { Prompt } from '@/types/database';
import { MessageSquare, Image, Video } from 'lucide-react';

interface PromptsTableProps {
  prompts: Array<Prompt & { flow?: { id: string; name: string } | null }>;
}

const endpointIcons: Record<string, React.ReactNode> = {
  Chat: <MessageSquare className="h-4 w-4" />,
  ImageToImage: <Image className="h-4 w-4" />,
  ImageToVideo: <Video className="h-4 w-4" />,
  VideoToVideo: <Video className="h-4 w-4" />,
};

const endpointColors: Record<string, string> = {
  Chat: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ImageToImage: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  ImageToVideo: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  VideoToVideo: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

export function PromptsTable({ prompts }: PromptsTableProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
        <p className="text-lg font-medium">No prompts found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a flow and add prompts to get started
        </p>
        <Link href="/flows/new" className="mt-4">
          <Badge variant="outline">Create Flow</Badge>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Flow</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {prompts.map((prompt) => (
            <TableRow key={prompt.id}>
              <TableCell>
                <Badge variant="outline" className={endpointColors[prompt.endpoint_type]}>
                  {endpointIcons[prompt.endpoint_type]}
                  <span className="ml-1">{prompt.endpoint_type}</span>
                </Badge>
              </TableCell>
              <TableCell>
                {prompt.flow ? (
                  <Link
                    href={`/flows/${prompt.flow.id}`}
                    className="hover:underline"
                  >
                    {prompt.flow.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>{prompt.selected_provider}</TableCell>
              <TableCell className="font-mono text-sm">
                {prompt.selected_model}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(prompt.created_at), {
                  addSuffix: true,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
