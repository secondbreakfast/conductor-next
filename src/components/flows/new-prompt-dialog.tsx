'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { CHAT_MODELS, IMAGE_MODELS, VIDEO_MODELS, EndpointType, Provider } from '@/types/database';
import { toast } from 'sonner';

interface NewPromptDialogProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPromptDialog({ flowId, open, onOpenChange }: NewPromptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [endpointType, setEndpointType] = useState<EndpointType>('ImageToImage');
  const [provider, setProvider] = useState<Provider>('Stability');
  const [model, setModel] = useState<string>('replace_background_and_relight');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [foregroundPrompt, setForegroundPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');

  const getModelsForEndpoint = () => {
    switch (endpointType) {
      case 'Chat':
        return CHAT_MODELS[provider as keyof typeof CHAT_MODELS] || [];
      case 'ImageToImage':
        return IMAGE_MODELS[provider as keyof typeof IMAGE_MODELS] || [];
      case 'ImageToVideo':
      case 'VideoToVideo':
        return VIDEO_MODELS[provider as keyof typeof VIDEO_MODELS] || [];
      default:
        return [];
    }
  };

  const getProvidersForEndpoint = (): Provider[] => {
    switch (endpointType) {
      case 'Chat':
        return Object.keys(CHAT_MODELS) as Provider[];
      case 'ImageToImage':
        return Object.keys(IMAGE_MODELS) as Provider[];
      case 'ImageToVideo':
      case 'VideoToVideo':
        return Object.keys(VIDEO_MODELS) as Provider[];
      default:
        return [];
    }
  };

  const handleEndpointChange = (value: EndpointType) => {
    setEndpointType(value);
    const providers = getProvidersForEndpoint();
    const defaultProvider = providers[0] || 'OpenAI';
    setProvider(defaultProvider);

    // Set default model
    const models = (() => {
      switch (value) {
        case 'Chat':
          return CHAT_MODELS[defaultProvider as keyof typeof CHAT_MODELS] || [];
        case 'ImageToImage':
          return IMAGE_MODELS[defaultProvider as keyof typeof IMAGE_MODELS] || [];
        case 'ImageToVideo':
        case 'VideoToVideo':
          return VIDEO_MODELS[defaultProvider as keyof typeof VIDEO_MODELS] || [];
        default:
          return [];
      }
    })();
    setModel(models[0] || '');
  };

  const handleProviderChange = (value: Provider) => {
    setProvider(value);
    const models = (() => {
      switch (endpointType) {
        case 'Chat':
          return CHAT_MODELS[value as keyof typeof CHAT_MODELS] || [];
        case 'ImageToImage':
          return IMAGE_MODELS[value as keyof typeof IMAGE_MODELS] || [];
        case 'ImageToVideo':
        case 'VideoToVideo':
          return VIDEO_MODELS[value as keyof typeof VIDEO_MODELS] || [];
        default:
          return [];
      }
    })();
    setModel(models[0] || '');
  };

  const handleSubmit = async () => {
    if (!model) {
      toast.error('Please select a model');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: {
            flow_id: flowId,
            endpoint_type: endpointType,
            selected_provider: provider,
            selected_model: model,
            system_prompt: systemPrompt || null,
            background_prompt: backgroundPrompt || null,
            foreground_prompt: foregroundPrompt || null,
            negative_prompt: negativePrompt || null,
          },
        }),
      });

      if (response.ok) {
        toast.success('Prompt created');
        onOpenChange(false);
        window.location.reload();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create prompt');
      }
    } catch (error) {
      toast.error('Failed to create prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableProviders = getProvidersForEndpoint();
  const availableModels = getModelsForEndpoint();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Prompt</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Endpoint Type</Label>
              <Select value={endpointType} onValueChange={(v) => handleEndpointChange(v as EndpointType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chat">Chat</SelectItem>
                  <SelectItem value="ImageToImage">Image to Image</SelectItem>
                  <SelectItem value="ImageToVideo">Image to Video</SelectItem>
                  <SelectItem value="VideoToVideo">Video to Video</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => handleProviderChange(v as Provider)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableProviders.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {endpointType === 'Chat' && (
            <div className="space-y-2">
              <Label>System Prompt</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                placeholder="System prompt for the chat model..."
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variable}}'} syntax for template variables
              </p>
            </div>
          )}

          {(endpointType === 'ImageToImage' || endpointType === 'ImageToVideo') && (
            <>
              <div className="space-y-2">
                <Label>Background Prompt</Label>
                <Textarea
                  value={backgroundPrompt}
                  onChange={(e) => setBackgroundPrompt(e.target.value)}
                  rows={2}
                  placeholder="Describe the background..."
                />
              </div>
              <div className="space-y-2">
                <Label>Foreground Prompt</Label>
                <Textarea
                  value={foregroundPrompt}
                  onChange={(e) => setForegroundPrompt(e.target.value)}
                  rows={2}
                  placeholder="Describe the foreground..."
                />
              </div>
              <div className="space-y-2">
                <Label>Negative Prompt</Label>
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                  placeholder="What to avoid..."
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Prompt'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
