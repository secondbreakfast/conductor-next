'use client';

import { useState } from 'react';
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
import { ArrowLeft, Loader2, Upload, X } from 'lucide-react';
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
  const [inputImageUrl, setInputImageUrl] = useState('');
  const [message, setMessage] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [variables, setVariables] = useState('{}');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');

  const handleAddAttachment = () => {
    if (newAttachmentUrl.trim()) {
      setAttachmentUrls([...attachmentUrls, newAttachmentUrl.trim()]);
      setNewAttachmentUrl('');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachmentUrls(attachmentUrls.filter((_, i) => i !== index));
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
      const response = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: {
            flow_id: flowId,
            input_image_url: inputImageUrl || undefined,
            message: message || undefined,
            webhook_url: webhookUrl || undefined,
            variables: parsedVariables,
            attachment_urls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
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

          {/* Input Image URL */}
          <div className="space-y-2">
            <Label htmlFor="inputImageUrl">Input Image URL</Label>
            <Input
              id="inputImageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={inputImageUrl}
              onChange={(e) => setInputImageUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              URL of the image to process
            </p>
            {inputImageUrl && (
              <div className="mt-2">
                <img
                  src={inputImageUrl}
                  alt="Preview"
                  className="h-32 w-32 rounded border object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
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

          {/* Additional Attachments */}
          <div className="space-y-2">
            <Label>Additional Attachment URLs</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com/image2.jpg"
                value={newAttachmentUrl}
                onChange={(e) => setNewAttachmentUrl(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleAddAttachment}>
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            {attachmentUrls.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachmentUrls.map((url, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-sm"
                  >
                    <span className="max-w-[200px] truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(index)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
