'use client';

import { useState } from 'react';
import Link from 'next/link';
import { generateSlug, sanitizeSlugInput } from '@/lib/slug';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Edit,
  Plus,
  Play,
  Save,
  Trash2,
  GripVertical,
  X,
  List,
} from 'lucide-react';
import { Flow, Prompt, EndpointType, Provider } from '@/types/database';
import { PromptCard } from './prompt-card';
import { NewPromptDialog } from './new-prompt-dialog';
import { toast } from 'sonner';

interface FlowDetailProps {
  flow: Flow & { prompts: Prompt[] };
}

export function FlowDetail({ flow }: FlowDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description || '');
  const [slug, setSlug] = useState(flow.slug || '');
  const [showSlugWarning, setShowSlugWarning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewPrompt, setShowNewPrompt] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/flows/${flow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow: { name, description, slug: slug.trim() || null } }),
      });

      if (response.ok) {
        toast.success('Flow updated');
        setIsEditing(false);
        window.location.reload();
      } else {
        toast.error('Failed to update flow');
      }
    } catch (error) {
      toast.error('Failed to update flow');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Prompt deleted');
        window.location.reload();
      } else {
        toast.error('Failed to delete prompt');
      }
    } catch (error) {
      toast.error('Failed to delete prompt');
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/flows">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Flows
        </Button>
      </Link>

      {/* Flow Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-2xl font-bold"
                    placeholder="Flow name"
                  />
                </div>
                <div>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="slug" className="text-sm font-medium">Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      const newSlug = sanitizeSlugInput(e.target.value);
                      setSlug(newSlug);
                      setShowSlugWarning(flow.slug ? newSlug !== flow.slug : false);
                    }}
                    placeholder="my-flow-name"
                    className="mt-1"
                  />
                  {showSlugWarning && (
                    <p className="mt-1 text-sm text-amber-600">
                      Changing the slug may break external links.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <CardTitle className="text-2xl">{flow.name}</CardTitle>
                {flow.description && (
                  <p className="mt-1 text-muted-foreground">{flow.description}</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setName(flow.name);
                    setDescription(flow.description || '');
                    setSlug(flow.slug || '');
                    setShowSlugWarning(false);
                    setIsEditing(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => {
                  setIsEditing(true);
                  if (!flow.slug && flow.name) {
                    setSlug(generateSlug(flow.name));
                  }
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Link href={`/runs?flow_id=${flow.id}`}>
                  <Button variant="outline" size="sm">
                    <List className="mr-2 h-4 w-4" />
                    View Runs
                  </Button>
                </Link>
                <Link href={`/runs/new?flow_id=${flow.id}`}>
                  <Button size="sm">
                    <Play className="mr-2 h-4 w-4" />
                    Run Flow
                  </Button>
                </Link>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>ID: <code className="text-xs">{flow.id}</code></span>
            {flow.slug && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span>Slug: <code className="text-xs">{flow.slug}</code></span>
              </>
            )}
            <Separator orientation="vertical" className="h-4" />
            <span>{flow.prompts?.length || 0} prompt{(flow.prompts?.length || 0) !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Prompts Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Prompts</h2>
          <Button size="sm" onClick={() => setShowNewPrompt(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Prompt
          </Button>
        </div>

        {flow.prompts && flow.prompts.length > 0 ? (
          <div className="space-y-4">
            {flow.prompts.map((prompt, index) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                index={index}
                onDelete={() => handleDeletePrompt(prompt.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No prompts in this flow</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setShowNewPrompt(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add First Prompt
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Prompt Dialog */}
      <NewPromptDialog
        flowId={flow.id}
        open={showNewPrompt}
        onOpenChange={setShowNewPrompt}
      />
    </div>
  );
}
