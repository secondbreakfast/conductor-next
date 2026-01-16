'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Trash2, Copy, Check, Download, Film, Upload, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { Media } from '@/lib/db/schema';
import type { MediaUsage } from '@/app/(app)/library/[id]/page';

interface MediaDetailProps {
  media: Media;
  usage?: MediaUsage;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaDetail({ media, usage }: MediaDetailProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this media?')) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/media/${media.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Media deleted');
        router.push('/library');
      } else {
        toast.error('Failed to delete media');
      }
    } catch {
      toast.error('Failed to delete media');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(media.id);
    setCopied(true);
    toast.success('ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(media.url);
    toast.success('URL copied to clipboard');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/library">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {media.id}
              <button
                onClick={handleCopyId}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </h1>
            <p className="text-sm text-muted-foreground">{media.filename}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyUrl}>
            <Copy className="mr-2 h-4 w-4" />
            Copy URL
          </Button>
          <a href={media.url} download={media.filename}>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </a>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex gap-8">
          {/* Media Preview */}
          <div className="flex-1 flex items-start justify-center rounded-xl bg-muted/30 p-8">
            {media.type === 'image' ? (
              <img
                src={media.url}
                alt={media.filename}
                className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg"
              />
            ) : (
              <div className="relative">
                <video
                  src={media.url}
                  controls
                  className="max-h-[70vh] max-w-full rounded-lg shadow-lg"
                />
                <div className="absolute top-4 left-4">
                  <Film className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              </div>
            )}
          </div>

          {/* Details & Usage Column */}
          <div className="w-[400px] space-y-6 flex-shrink-0">
            {/* Details */}
            <div className="rounded-lg border p-4">
              <h2 className="font-semibold mb-4">Details</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium capitalize">{media.type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">MIME Type</dt>
                  <dd className="font-medium">{media.mimeType || 'Unknown'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium">{formatBytes(media.size)}</dd>
                </div>
                {media.width && media.height && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Dimensions</dt>
                    <dd className="font-medium">
                      {media.width} x {media.height}
                    </dd>
                  </div>
                )}
                {media.duration && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Duration</dt>
                    <dd className="font-medium">{media.duration.toFixed(1)}s</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Uploaded</dt>
                  <dd className="font-medium">
                    {media.createdAt
                      ? formatDistanceToNow(new Date(media.createdAt), {
                          addSuffix: true,
                        })
                      : 'Unknown'}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 pt-4 border-t">
                <dt className="text-sm text-muted-foreground mb-2">URL</dt>
                <p className="text-xs text-muted-foreground break-all font-mono bg-muted p-2 rounded">
                  {media.url}
                </p>
              </div>
            </div>

            {/* Usage Section */}
            {usage && (usage.asInput.length > 0 || usage.asOutput.length > 0) && (
              <div className="rounded-lg border p-4">
                <h2 className="font-semibold mb-4">Usage</h2>
                <div className="space-y-6">
                  {/* Generated By */}
                  {usage.asOutput.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Generated by</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">Prompt</TableHead>
                            <TableHead className="h-8 text-xs">Run</TableHead>
                            <TableHead className="h-8 text-xs text-right">When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usage.asOutput.map((item) => (
                            <TableRow key={item.promptRun.id}>
                              <TableCell className="py-2">
                                <Link
                                  href={`/flows/${item.run.flow?.id}`}
                                  className="flex items-center gap-1.5 text-xs hover:underline"
                                >
                                  <Badge variant="outline" className="text-[10px] h-5">
                                    {item.promptRun.prompt?.endpoint_type || 'Unknown'}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {item.promptRun.prompt?.selected_provider}
                                  </span>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </Link>
                              </TableCell>
                              <TableCell className="py-2">
                                <Link
                                  href={`/runs/${item.run.id}`}
                                  className="flex items-center gap-1.5 text-xs hover:underline"
                                >
                                  <span>{item.run.flow?.name || 'Run'}</span>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </Link>
                              </TableCell>
                              <TableCell className="py-2 text-right text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.run.created_at), { addSuffix: true })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Used As Input */}
                  {usage.asInput.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Used as input in</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="h-8 text-xs">Run</TableHead>
                            <TableHead className="h-8 text-xs">Status</TableHead>
                            <TableHead className="h-8 text-xs text-right">When</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usage.asInput.map((item) => (
                            <TableRow key={item.run.id}>
                              <TableCell className="py-2">
                                <Link
                                  href={`/runs/${item.run.id}`}
                                  className="flex items-center gap-1.5 text-xs hover:underline"
                                >
                                  <span>{item.run.flow?.name || 'Unknown flow'}</span>
                                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                </Link>
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] h-5 ${
                                    item.run.status === 'completed'
                                      ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                      : item.run.status === 'failed'
                                      ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                      : 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                  }`}
                                >
                                  {item.run.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2 text-right text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.run.created_at), { addSuffix: true })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
