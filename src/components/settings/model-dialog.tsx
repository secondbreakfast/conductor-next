'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ModelRecord, EndpointType } from '@/types/database';

const ENDPOINT_TYPES: EndpointType[] = [
  'Chat',
  'ImageToImage',
  'ImageToVideo',
  'VideoToVideo',
  'AudioToText',
  'TextToAudio',
];

interface ModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string | null;
  model: ModelRecord | null;
}

export function ModelDialog({ open, onOpenChange, providerId, model }: ModelDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('');
  const [endpointTypes, setEndpointTypes] = useState<EndpointType[]>([]);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [defaultParams, setDefaultParams] = useState('{}');
  const [inputPrice, setInputPrice] = useState('');
  const [outputPrice, setOutputPrice] = useState('');

  const isEditing = !!model;

  useEffect(() => {
    if (model) {
      setName(model.name);
      setModelId(model.model_id);
      setEndpointTypes(model.endpoint_types);
      setDisplayOrder(model.display_order);
      setDefaultParams(JSON.stringify(model.default_params || {}, null, 2));
      setInputPrice(model.input_price?.toString() || '');
      setOutputPrice(model.output_price?.toString() || '');
    } else {
      setName('');
      setModelId('');
      setEndpointTypes([]);
      setDisplayOrder(0);
      setDefaultParams('{}');
      setInputPrice('');
      setOutputPrice('');
    }
  }, [model, open]);

  const toggleEndpointType = (type: EndpointType) => {
    setEndpointTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Model name is required');
      return;
    }
    if (!modelId.trim()) {
      toast.error('Model ID is required');
      return;
    }
    if (endpointTypes.length === 0) {
      toast.error('At least one endpoint type is required');
      return;
    }

    let parsedDefaultParams = {};
    try {
      parsedDefaultParams = JSON.parse(defaultParams);
    } catch {
      toast.error('Default parameters must be valid JSON');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/settings/models/${model.id}`
        : '/api/settings/models';

      const payload: Record<string, unknown> = {
        name: name.trim(),
        model_id: modelId.trim(),
        endpoint_types: endpointTypes,
        display_order: displayOrder,
        default_params: parsedDefaultParams,
        input_price: inputPrice ? parseFloat(inputPrice) : null,
        output_price: outputPrice ? parseFloat(outputPrice) : null,
      };

      if (!isEditing) {
        payload.provider_id = providerId;
      }

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: payload }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save model');
      }

      toast.success(isEditing ? 'Model updated' : 'Model created');
      onOpenChange(false);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save model');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Model' : 'Add Model'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., GPT-4.1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model_id">Model ID</Label>
            <Input
              id="model_id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g., gpt-4.1"
            />
            <p className="text-xs text-muted-foreground">
              The exact model identifier used in API calls
            </p>
          </div>

          <div className="space-y-2">
            <Label>Endpoint Types</Label>
            <div className="flex flex-wrap gap-2">
              {ENDPOINT_TYPES.map((type) => (
                <Badge
                  key={type}
                  variant={endpointTypes.includes(type) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleEndpointType(type)}
                >
                  {type}
                  {endpointTypes.includes(type) && (
                    <X className="ml-1 h-3 w-3" />
                  )}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Select which endpoint types this model supports
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_order">Display Order</Label>
            <Input
              id="display_order"
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="input_price">Input Price (per 1K tokens)</Label>
              <Input
                id="input_price"
                type="number"
                step="0.000001"
                value={inputPrice}
                onChange={(e) => setInputPrice(e.target.value)}
                placeholder="e.g., 0.002"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="output_price">Output Price (per 1K tokens)</Label>
              <Input
                id="output_price"
                type="number"
                step="0.000001"
                value={outputPrice}
                onChange={(e) => setOutputPrice(e.target.value)}
                placeholder="e.g., 0.008"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_params">Default Parameters (JSON)</Label>
            <Textarea
              id="default_params"
              value={defaultParams}
              onChange={(e) => setDefaultParams(e.target.value)}
              className="font-mono text-sm"
              rows={4}
              placeholder='{"temperature": 0.7, "max_tokens": 4096}'
            />
            <p className="text-xs text-muted-foreground">
              Default values for temperature, max_tokens, etc.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
