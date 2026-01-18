'use client';

import { useState, useEffect } from 'react';
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
import { EndpointType, Provider } from '@/types/database';
import { toast } from 'sonner';
import { useModels, getProvidersFromModels, getModelsForProvider } from '@/hooks/use-models';

interface NewPromptDialogProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewPromptDialog({ flowId, open, onOpenChange }: NewPromptDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [endpointType, setEndpointType] = useState<EndpointType>('ImageToImage');
  const [provider, setProvider] = useState<Provider>('' as Provider);
  const [model, setModel] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [foregroundPrompt, setForegroundPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');

  const { models, isLoading: modelsLoading } = useModels({ endpointType });
  const providers = getProvidersFromModels(models);
  const providerModels = getModelsForProvider(models, provider.toLowerCase());

  useEffect(() => {
    if (models.length > 0) {
      const providerInList = providers.some((p) => p.name === provider);
      if (!provider || !providerInList) {
        const firstProvider = providers[0];
        if (firstProvider) {
          setProvider(firstProvider.name as Provider);
        }
      }
    }
  }, [models, providers, provider]);

  useEffect(() => {
    if (providerModels.length > 0) {
      const modelInList = providerModels.some((m) => m.model_id === model);
      if (!model || !modelInList) {
        setModel(providerModels[0].model_id);
      }
    }
  }, [providerModels, model]);

  const handleEndpointChange = (value: EndpointType) => {
    setEndpointType(value);
    setProvider('' as Provider);
    setModel('');
  };

  const handleProviderChange = (value: Provider) => {
    setProvider(value);
    setModel('');
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
    } catch {
      toast.error('Failed to create prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <Select
                value={provider}
                onValueChange={(v) => handleProviderChange(v as Provider)}
                disabled={modelsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={modelsLoading ? 'Loading...' : 'Select provider'} />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={model}
                onValueChange={setModel}
                disabled={modelsLoading || !provider}
              >
                <SelectTrigger>
                  <SelectValue placeholder={modelsLoading ? 'Loading...' : 'Select model'} />
                </SelectTrigger>
                <SelectContent>
                  {providerModels.map((m) => (
                    <SelectItem key={m.id} value={m.model_id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chat endpoint - show system prompt */}
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

          {/* OpenAI/Gemini image - show simple prompt */}
          {(endpointType === 'ImageToImage' || endpointType === 'ImageToVideo') && (provider === 'OpenAI' || provider === 'Gemini') && (
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                placeholder="Describe what you want to generate or edit..."
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variable}}'} syntax for template variables
              </p>
            </div>
          )}

          {/* Stability - show background/foreground/negative prompts */}
          {(endpointType === 'ImageToImage' || endpointType === 'ImageToVideo') && provider === 'Stability' && (
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
