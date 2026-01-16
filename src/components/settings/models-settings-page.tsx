'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderRecord, ModelRecord } from '@/types/database';
import { ProviderDialog } from './provider-dialog';
import { ModelDialog } from './model-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ModelsSettingsPageProps {
  providers: (ProviderRecord & { models: ModelRecord[] })[];
}

export function ModelsSettingsPage({ providers: initialProviders }: ModelsSettingsPageProps) {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(
    new Set(initialProviders.map((p) => p.id))
  );
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderRecord | null>(null);
  const [editingModel, setEditingModel] = useState<ModelRecord | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<{ model: ModelRecord; promptsAffected: number } | null>(null);

  const toggleProvider = (providerId: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const handleProviderToggle = async (provider: ProviderRecord) => {
    try {
      const response = await fetch(`/api/settings/providers/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: { enabled: !provider.enabled } }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update provider');
      }

      toast.success(`${provider.name} ${provider.enabled ? 'disabled' : 'enabled'}`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update provider');
    }
  };

  const handleModelToggle = async (model: ModelRecord) => {
    try {
      const response = await fetch(`/api/settings/models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: { enabled: !model.enabled } }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update model');
      }

      toast.success(`${model.name} ${model.enabled ? 'disabled' : 'enabled'}`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update model');
    }
  };

  const handleEditProvider = (provider: ProviderRecord) => {
    setEditingProvider(provider);
    setProviderDialogOpen(true);
  };

  const handleAddModel = (providerId: string) => {
    setSelectedProviderId(providerId);
    setEditingModel(null);
    setModelDialogOpen(true);
  };

  const handleEditModel = (model: ModelRecord) => {
    setEditingModel(model);
    setSelectedProviderId(model.provider_id);
    setModelDialogOpen(true);
  };

  const handleDeleteModel = async (model: ModelRecord) => {
    try {
      const response = await fetch(`/api/settings/models/${model.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete model');
      }

      const data = await response.json();
      if (data.prompts_affected > 0) {
        setModelToDelete({ model, promptsAffected: data.prompts_affected });
        setDeleteDialogOpen(true);
      } else {
        toast.success(`${model.name} deleted`);
        window.location.reload();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete model');
    }
  };

  const confirmDeleteModel = async () => {
    if (!modelToDelete) return;

    toast.success(`${modelToDelete.model.name} deleted`);
    window.location.reload();
  };

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Providers & Models</CardTitle>
              <CardDescription>
                Configure which AI providers and models are available for use in flows.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingProvider(null);
                setProviderDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Provider
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {initialProviders.map((provider) => (
                <Collapsible
                  key={provider.id}
                  open={expandedProviders.has(provider.id)}
                  onOpenChange={() => toggleProvider(provider.id)}
                >
                  <div className="rounded-lg border">
                    <CollapsibleTrigger asChild>
                      <div className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          {expandedProviders.has(provider.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{provider.name}</span>
                          <Badge variant={provider.enabled ? 'default' : 'secondary'}>
                            {provider.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {provider.models?.length || 0} models
                          </span>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={provider.enabled}
                            onCheckedChange={() => handleProviderToggle(provider)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditProvider(provider)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t px-4 py-2">
                        <div className="mb-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddModel(provider.id)}
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Add Model
                          </Button>
                        </div>
                        {provider.models && provider.models.length > 0 ? (
                          <div className="space-y-1">
                            {provider.models.map((model) => (
                              <div
                                key={model.id}
                                className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm">{model.name}</span>
                                  <code className="text-xs text-muted-foreground">
                                    {model.model_id}
                                  </code>
                                  <div className="flex gap-1">
                                    {model.endpoint_types.map((type) => (
                                      <Badge key={type} variant="outline" className="text-xs">
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={model.enabled}
                                    onCheckedChange={() => handleModelToggle(model)}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditModel(model)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteModel(model)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="py-4 text-center text-sm text-muted-foreground">
                            No models configured for this provider.
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}

              {initialProviders.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No providers configured. Add a provider to get started.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ProviderDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        provider={editingProvider}
      />

      <ModelDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        providerId={selectedProviderId}
        model={editingModel}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Model deleted</AlertDialogTitle>
            <AlertDialogDescription>
              {modelToDelete?.promptsAffected} prompt(s) were using this model. They will continue
              to work but may show a warning.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={confirmDeleteModel}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
