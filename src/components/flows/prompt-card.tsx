'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  Edit,
  Save,
  Trash2,
  X,
  MessageSquare,
  Image,
  Video,
} from 'lucide-react';
import { Prompt, EndpointType, Provider } from '@/types/database';
import { toast } from 'sonner';
import { useModels, getProvidersFromModels, getModelsForProvider } from '@/hooks/use-models';

interface PromptCardProps {
  prompt: Prompt;
  index: number;
  onDelete: () => void;
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

export function PromptCard({ prompt, index, onDelete }: PromptCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    endpoint_type: prompt.endpoint_type,
    selected_provider: prompt.selected_provider,
    selected_model: prompt.selected_model,
    system_prompt: prompt.system_prompt || '',
    background_prompt: prompt.background_prompt || '',
    foreground_prompt: prompt.foreground_prompt || '',
    negative_prompt: prompt.negative_prompt || '',
    tools: JSON.stringify(prompt.tools || [], null, 2),
    video_duration: prompt.video_duration || 8,
  });

  const { models, isLoading: modelsLoading } = useModels({ endpointType: formData.endpoint_type });
  const providers = getProvidersFromModels(models);
  const providerModels = getModelsForProvider(models, formData.selected_provider.toLowerCase());

  useEffect(() => {
    if (models.length > 0) {
      const providerInList = providers.some((p) => p.name === formData.selected_provider);
      if (!formData.selected_provider || !providerInList) {
        const firstProvider = providers[0];
        if (firstProvider) {
          setFormData((prev) => ({ ...prev, selected_provider: firstProvider.name as Provider }));
        }
      }
    }
  }, [models, providers, formData.selected_provider]);

  useEffect(() => {
    if (providerModels.length > 0) {
      const modelInList = providerModels.some((m) => m.model_id === formData.selected_model);
      if (!formData.selected_model || !modelInList) {
        setFormData((prev) => ({ ...prev, selected_model: providerModels[0].model_id }));
      }
    }
  }, [providerModels, formData.selected_model]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let tools = [];
      try {
        tools = JSON.parse(formData.tools);
      } catch {
        toast.error('Invalid JSON in tools field');
        setIsSaving(false);
        return;
      }

      const response = await fetch(`/api/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: {
            endpoint_type: formData.endpoint_type,
            selected_provider: formData.selected_provider,
            selected_model: formData.selected_model,
            system_prompt: formData.system_prompt || null,
            background_prompt: formData.background_prompt || null,
            foreground_prompt: formData.foreground_prompt || null,
            negative_prompt: formData.negative_prompt || null,
            tools,
            video_duration: formData.endpoint_type === 'ImageToVideo' ? formData.video_duration : null,
          },
        }),
      });

      if (response.ok) {
        toast.success('Prompt updated');
        setIsEditing(false);
        window.location.reload();
      } else {
        toast.error('Failed to update prompt');
      }
    } catch {
      toast.error('Failed to update prompt');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex flex-1 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {index + 1}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={endpointColors[prompt.endpoint_type]}>
                  {endpointIcons[prompt.endpoint_type]}
                  <span className="ml-1">{prompt.endpoint_type}</span>
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {prompt.selected_provider} / {prompt.selected_model}
                </span>
              </div>
              <ChevronDown
                className={`ml-auto h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
            <div className="ml-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(!isEditing);
                  setIsOpen(true);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="border-t pt-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Endpoint Type</Label>
                    <Select
                      value={formData.endpoint_type}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          endpoint_type: value as EndpointType,
                          selected_provider: '' as Provider,
                          selected_model: '',
                        }))
                      }
                    >
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
                      value={formData.selected_provider}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          selected_provider: value as Provider,
                          selected_model: '',
                        }))
                      }
                      disabled={modelsLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={modelsLoading ? 'Loading...' : 'Select provider'} />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.name}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select
                      value={formData.selected_model}
                      onValueChange={(value) => {
                        const selectedModel = providerModels.find((m) => m.model_id === value);
                        setFormData((prev) => ({
                          ...prev,
                          selected_model: value,
                          ...(selectedModel?.default_params || {}),
                        }));
                      }}
                      disabled={modelsLoading || !formData.selected_provider}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={modelsLoading ? 'Loading...' : 'Select model'} />
                      </SelectTrigger>
                      <SelectContent>
                        {providerModels.map((model) => (
                          <SelectItem key={model.id} value={model.model_id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Chat endpoint - show system prompt and tools */}
                {formData.endpoint_type === 'Chat' && (
                  <>
                    <div className="space-y-2">
                      <Label>System Prompt</Label>
                      <Textarea
                        value={formData.system_prompt}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, system_prompt: e.target.value }))
                        }
                        rows={4}
                        placeholder="System prompt for the chat model..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tools (JSON)</Label>
                      <Textarea
                        value={formData.tools}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, tools: e.target.value }))
                        }
                        rows={4}
                        className="font-mono text-sm"
                        placeholder="[]"
                      />
                    </div>
                  </>
                )}

                {/* OpenAI/Gemini image - show simple prompt */}
                {(formData.endpoint_type === 'ImageToImage' ||
                  formData.endpoint_type === 'ImageToVideo') &&
                  (formData.selected_provider === 'OpenAI' || formData.selected_provider === 'Gemini') && (
                  <div className="space-y-2">
                    <Label>Prompt</Label>
                    <Textarea
                      value={formData.system_prompt}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, system_prompt: e.target.value }))
                      }
                      rows={4}
                      placeholder="Describe what you want to generate or edit..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{{variable}}'} syntax for template variables
                    </p>
                  </div>
                )}

                {/* Video duration for ImageToVideo */}
                {formData.endpoint_type === 'ImageToVideo' && (
                  <div className="space-y-2">
                    <Label>Video Duration</Label>
                    <Select
                      value={String(formData.video_duration)}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, video_duration: Number(value) }))
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="6">6 seconds</SelectItem>
                        <SelectItem value="8">8 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Stability - show background/foreground/negative prompts */}
                {(formData.endpoint_type === 'ImageToImage' ||
                  formData.endpoint_type === 'ImageToVideo') &&
                  formData.selected_provider === 'Stability' && (
                  <>
                    <div className="space-y-2">
                      <Label>Background Prompt</Label>
                      <Textarea
                        value={formData.background_prompt}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, background_prompt: e.target.value }))
                        }
                        rows={2}
                        placeholder="Describe the background..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Foreground Prompt</Label>
                      <Textarea
                        value={formData.foreground_prompt}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, foreground_prompt: e.target.value }))
                        }
                        rows={2}
                        placeholder="Describe the foreground..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Negative Prompt</Label>
                      <Textarea
                        value={formData.negative_prompt}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, negative_prompt: e.target.value }))
                        }
                        rows={2}
                        placeholder="What to avoid..."
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {prompt.system_prompt && (
                  <div>
                    <p className="mb-1 text-sm font-medium">System Prompt</p>
                    <div className="rounded-lg bg-muted p-3">
                      <pre className="whitespace-pre-wrap text-sm">
                        {prompt.system_prompt}
                      </pre>
                    </div>
                  </div>
                )}

                {prompt.background_prompt && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Background Prompt</p>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-sm">{prompt.background_prompt}</p>
                    </div>
                  </div>
                )}

                {prompt.foreground_prompt && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Foreground Prompt</p>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-sm">{prompt.foreground_prompt}</p>
                    </div>
                  </div>
                )}

                {prompt.negative_prompt && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Negative Prompt</p>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-sm">{prompt.negative_prompt}</p>
                    </div>
                  </div>
                )}

                {prompt.tools && prompt.tools.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Tools</p>
                    <div className="rounded-lg bg-muted p-2">
                      <pre className="text-xs">
                        {JSON.stringify(prompt.tools, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {prompt.endpoint_type === 'ImageToVideo' && prompt.video_duration && (
                  <div>
                    <p className="mb-1 text-sm font-medium">Video Duration</p>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-sm">{prompt.video_duration} seconds</p>
                    </div>
                  </div>
                )}

                {!prompt.system_prompt &&
                  !prompt.background_prompt &&
                  !prompt.foreground_prompt &&
                  !prompt.negative_prompt &&
                  (!prompt.tools || prompt.tools.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      No configuration set for this prompt
                    </p>
                  )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
