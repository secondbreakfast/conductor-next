'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Clock,
  Zap,
  DollarSign,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Run, RunStatus, PromptRun, TOKEN_PRICING } from '@/types/database';
import { toast } from 'sonner';

interface RunDetailProps {
  run: Run & {
    flow?: { id: string; name: string; description: string | null } | null;
    prompt_runs?: Array<
      PromptRun & {
        prompt?: {
          id: string;
          endpoint_type: string;
          selected_provider: string;
          selected_model: string;
          system_prompt: string | null;
          background_prompt: string | null;
          foreground_prompt: string | null;
          negative_prompt: string | null;
          tools: Record<string, unknown>[] | null;
        } | null;
      }
    >;
  };
}

const statusColors: Record<RunStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-500 border-green-500/20',
  failed: 'bg-red-500/10 text-red-500 border-red-500/20',
  'timed-out': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const statusIcons: Record<RunStatus, React.ReactNode> = {
  pending: <Loader2 className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  'timed-out': <Clock className="h-4 w-4" />,
};

export function RunDetail({ run }: RunDetailProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const response = await fetch(`/api/runs/${run.id}/rerun`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        toast.success('New run created');
        window.location.href = data.redirect_url;
      } else {
        toast.error('Failed to create rerun');
      }
    } catch {
      toast.error('Failed to create rerun');
    } finally {
      setIsRetrying(false);
    }
  };

  const calculateTotalCost = (): number => {
    if (!run.prompt_runs) return 0;
    let total = 0;
    for (const pr of run.prompt_runs) {
      const model = pr.model || '';
      const pricing = TOKEN_PRICING[model];
      if (pricing && pr.input_tokens && pr.output_tokens) {
        total +=
          (pr.input_tokens / 1000) * pricing.input +
          (pr.output_tokens / 1000) * pricing.output;
      }
    }
    return total;
  };

  const totalTokens =
    run.prompt_runs?.reduce((sum, pr) => sum + (pr.total_tokens || 0), 0) || 0;
  const totalCost = calculateTotalCost();

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/runs">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Runs
        </Button>
      </Link>

      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl">Run Details</CardTitle>
            <p className="font-mono text-sm text-muted-foreground">{run.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(run.id)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </Button>
            {(run.status === 'failed' || run.status === 'pending') && (
              <Button size="sm" onClick={handleRetry} disabled={isRetrying}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {run.status === 'failed' ? 'Retry' : 'Refresh'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-4">
            {/* Status */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline" className={statusColors[run.status]}>
                <span className="mr-1">{statusIcons[run.status]}</span>
                {run.status}
              </Badge>
            </div>

            {/* Flow */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Flow</p>
              {run.flow ? (
                <Link href={`/flows/${run.flow.id}`} className="text-sm font-medium hover:underline">
                  {run.flow.name}
                </Link>
              ) : (
                <p className="text-sm">-</p>
              )}
            </div>

            {/* Source Run (if this is a rerun) */}
            {run.source_run_id && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Rerun of</p>
                <Link
                  href={`/runs/${run.source_run_id}`}
                  className="font-mono text-sm text-blue-500 hover:underline"
                >
                  {run.source_run_id.slice(0, 8)}...
                </Link>
              </div>
            )}

            {/* Tokens */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tokens</p>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{totalTokens.toLocaleString()}</span>
              </div>
            </div>

            {/* Cost */}
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Estimated Cost</p>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">${totalCost.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Timestamps */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm">
                {format(new Date(run.created_at), 'PPpp')}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
              </p>
            </div>
            {run.started_at && (
              <div>
                <p className="text-sm text-muted-foreground">Started</p>
                <p className="text-sm">
                  {format(new Date(run.started_at), 'PPpp')}
                </p>
              </div>
            )}
            {run.completed_at && (
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-sm">
                  {format(new Date(run.completed_at), 'PPpp')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="output" className="space-y-4">
        <TabsList>
          <TabsTrigger value="output">Output</TabsTrigger>
          <TabsTrigger value="prompts">Prompts ({run.prompt_runs?.length || 0})</TabsTrigger>
          <TabsTrigger value="input">Input</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>

        {/* Output Tab */}
        <TabsContent value="output">
          <Card>
            <CardHeader>
              <CardTitle>Output</CardTitle>
            </CardHeader>
            <CardContent>
              {run.data?.image_url ? (
                <div className="space-y-4">
                  <div className="relative aspect-square max-w-xl overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={run.data.image_url}
                      alt="Generated image"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <a href={run.data.image_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Full Size
                      </Button>
                    </a>
                    <a href={run.data.image_url} download>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </a>
                  </div>
                </div>
              ) : run.data?.video_url ? (
                <div className="space-y-4">
                  <div className="relative max-w-xl overflow-hidden rounded-lg border bg-muted">
                    <video
                      src={run.data.video_url}
                      controls
                      className="h-full w-full"
                    />
                  </div>
                  <div className="flex gap-2">
                    <a href={run.data.video_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                    </a>
                    <a href={run.data.video_url} download>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </a>
                  </div>
                </div>
              ) : run.data?.text ? (
                <div className="rounded-lg bg-muted p-4">
                  <pre className="whitespace-pre-wrap text-sm">{run.data.text}</pre>
                </div>
              ) : run.status === 'pending' ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </div>
              ) : (
                <p className="text-muted-foreground">No output available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts">
          <div className="space-y-4">
            {run.prompt_runs?.map((pr, index) => (
              <Card key={pr.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Step {index + 1}: {pr.prompt?.endpoint_type || 'Unknown'}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={statusColors[pr.status as RunStatus]}
                    >
                      {pr.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pr.prompt?.selected_provider} / {pr.prompt?.selected_model}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Prompt Text */}
                    {pr.prompt?.system_prompt && (
                      <div>
                        <p className="mb-2 text-sm font-medium">System Prompt</p>
                        <div className="rounded-lg bg-muted p-3">
                          <pre className="whitespace-pre-wrap text-sm">
                            {pr.prompt.system_prompt}
                          </pre>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => copyToClipboard(pr.prompt?.system_prompt || '')}
                        >
                          <Copy className="mr-2 h-3 w-3" />
                          Copy Prompt
                        </Button>
                      </div>
                    )}

                    {/* Image Prompts */}
                    {(pr.prompt?.background_prompt ||
                      pr.prompt?.foreground_prompt ||
                      pr.prompt?.negative_prompt) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {pr.prompt.background_prompt && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Background Prompt</p>
                            <div className="rounded-lg bg-muted p-2">
                              <p className="text-sm">{pr.prompt.background_prompt}</p>
                            </div>
                          </div>
                        )}
                        {pr.prompt.foreground_prompt && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Foreground Prompt</p>
                            <div className="rounded-lg bg-muted p-2">
                              <p className="text-sm">{pr.prompt.foreground_prompt}</p>
                            </div>
                          </div>
                        )}
                        {pr.prompt.negative_prompt && (
                          <div>
                            <p className="mb-1 text-sm font-medium">Negative Prompt</p>
                            <div className="rounded-lg bg-muted p-2">
                              <p className="text-sm">{pr.prompt.negative_prompt}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Token Usage */}
                    {(pr.input_tokens || pr.output_tokens) && (
                      <div className="flex gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Input: </span>
                          <span className="font-mono">{pr.input_tokens?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Output: </span>
                          <span className="font-mono">{pr.output_tokens?.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-mono">{pr.total_tokens?.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Output Attachments */}
                    {pr.attachment_urls && pr.attachment_urls.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Output</p>
                        <div className="flex flex-wrap gap-2">
                          {pr.attachment_urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block h-24 w-24 overflow-hidden rounded border"
                            >
                              <img
                                src={url}
                                alt={`Output ${i + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!run.prompt_runs || run.prompt_runs.length === 0) && (
              <p className="text-muted-foreground">No prompt runs available</p>
            )}
          </div>
        </TabsContent>

        {/* Input Tab */}
        <TabsContent value="input">
          <Card>
            <CardHeader>
              <CardTitle>Input</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {run.input_image_url && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Input Image</p>
                    <div className="relative aspect-square max-w-xs overflow-hidden rounded-lg border bg-muted">
                      <img
                        src={run.input_image_url}
                        alt="Input image"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {run.message && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Message</p>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-sm">{run.message}</p>
                    </div>
                  </div>
                )}

                {run.variables && Object.keys(run.variables).length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Variables</p>
                    <div className="rounded-lg bg-muted p-3">
                      <pre className="text-sm">
                        {JSON.stringify(run.variables, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {run.attachment_urls && run.attachment_urls.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Attachments</p>
                    <div className="flex flex-wrap gap-2">
                      {run.attachment_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block h-24 w-24 overflow-hidden rounded border"
                        >
                          <img
                            src={url}
                            alt={`Attachment ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {!run.input_image_url &&
                  !run.message &&
                  (!run.variables || Object.keys(run.variables).length === 0) &&
                  (!run.attachment_urls || run.attachment_urls.length === 0) && (
                    <p className="text-muted-foreground">No input data available</p>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Data Tab */}
        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Raw Response Data</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <pre className="rounded-lg bg-muted p-4 text-xs">
                  {JSON.stringify(run, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
