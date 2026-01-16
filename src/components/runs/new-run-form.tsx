'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Upload, X, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Flow {
  id: string;
  name: string;
  description: string | null;
}

interface NewRunFormProps {
  flows: Flow[];
}

export function NewRunForm({ flows }: NewRunFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flowId, setFlowId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [variables, setVariables] = useState('{}');
  const [attachments, setAttachments] = useState<{ id: string | null; url: string }[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = async (file: File): Promise<{ id: string; url: string } | null> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      return { id: data.id, url: data.url };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
      return null;
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    if (files.length === 0) {
      toast.error('Please drop image or video files');
      return;
    }

    setIsUploading(true);
    const uploadedAttachments: { id: string; url: string }[] = [];

    for (const file of files) {
      const result = await uploadFile(file);
      if (result) {
        uploadedAttachments.push(result);
      }
    }

    if (uploadedAttachments.length > 0) {
      setAttachments(prev => [...prev, ...uploadedAttachments]);
      toast.success(`${uploadedAttachments.length} file(s) uploaded`);
    }
    setIsUploading(false);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    const uploadedAttachments: { id: string; url: string }[] = [];

    for (const file of files) {
      const result = await uploadFile(file);
      if (result) {
        uploadedAttachments.push(result);
      }
    }

    if (uploadedAttachments.length > 0) {
      setAttachments(prev => [...prev, ...uploadedAttachments]);
      toast.success(`${uploadedAttachments.length} file(s) uploaded`);
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const handleAddAttachment = () => {
    if (newAttachmentUrl.trim()) {
      // Manual URL entry - no media ID
      setAttachments([...attachments, { id: null, url: newAttachmentUrl.trim() }]);
      setNewAttachmentUrl('');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!flowId) {
      toast.error('Please select a flow');
      return;
    }

    // Validate variables JSON
    let parsedVariables = {};
    try {
      parsedVariables = JSON.parse(variables);
    } catch {
      toast.error('Invalid JSON in variables field');
      return;
    }

    setIsSubmitting(true);

    try {
      // Extract URLs and media IDs from attachments
      const attachmentUrls = attachments.map(a => a.url);
      const inputMediaIds = attachments.map(a => a.id).filter((id): id is string => id !== null);

      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: {
            flow_id: flowId,
            message: message || undefined,
            webhook_url: webhookUrl || undefined,
            variables: parsedVariables,
            attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
            input_media_ids: inputMediaIds.length > 0 ? inputMediaIds : undefined,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create run');
      }

      const data = await response.json();
      toast.success('Run created successfully');
      router.push(`/runs/${data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create run');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedFlow = flows.find((f) => f.id === flowId);

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <Link href="/runs">
          <Button variant="ghost" size="sm" type="button">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Runs
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Flow Selection */}
          <div className="space-y-2">
            <Label htmlFor="flow">Flow *</Label>
            <Select value={flowId} onValueChange={setFlowId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a flow..." />
              </SelectTrigger>
              <SelectContent>
                {flows.map((flow) => (
                  <SelectItem key={flow.id} value={flow.id}>
                    {flow.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedFlow?.description && (
              <p className="text-sm text-muted-foreground">
                {selectedFlow.description}
              </p>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <p className="text-xs text-muted-foreground mb-2">
              The first image will be used as the primary input for image processing flows
            </p>
            <div
              className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <>
                  <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Drag and drop images here, or{' '}
                    <label className="cursor-pointer text-primary hover:underline">
                      browse
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="Or paste a URL..."
                value={newAttachmentUrl}
                onChange={(e) => setNewAttachmentUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttachment();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={handleAddAttachment}>
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={attachment.url}
                      alt={`Attachment ${index + 1}`}
                      className="h-20 w-20 rounded border object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {index === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-primary px-1 py-0.5 text-[10px] font-medium text-primary-foreground">
                        Primary
                      </span>
                    )}
                    {attachment.id && (
                      <span className="absolute bottom-1 right-1 rounded bg-green-500 px-1 py-0.5 text-[8px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {attachment.id}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Optional message or instructions..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <Label htmlFor="variables">Variables (JSON)</Label>
            <Textarea
              id="variables"
              placeholder='{"key": "value"}'
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Variables to pass to prompt templates (Mustache syntax)
            </p>
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL (optional)</Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://your-server.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Receive status updates when the run completes or fails
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Link href="/runs">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Run'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
