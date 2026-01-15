'use client';

import { useState, useEffect, useRef } from 'react';
import type { EndpointType, ModelOption } from '@/types/database';

interface UseModelsOptions {
  endpointType: EndpointType;
}

interface UseModelsResult {
  models: ModelOption[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

const CACHE_TTL = 60000; // 60 seconds

interface CacheEntry {
  data: ModelOption[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function useModels({ endpointType }: UseModelsOptions): UseModelsResult {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);

  const fetchModels = async () => {
    const fetchId = ++fetchIdRef.current;
    const cacheKey = endpointType;

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setModels(cached.data);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/models?endpoint_type=${encodeURIComponent(endpointType)}`);

      if (fetchId !== fetchIdRef.current) return;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch models');
      }

      const data = await response.json();

      cache.set(cacheKey, { data, timestamp: Date.now() });

      setModels(data);
      setError(null);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch models'));
      setModels([]);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchModels();
  }, [endpointType]);

  return {
    models,
    isLoading,
    error,
    refetch: fetchModels,
  };
}

export function getProvidersFromModels(models: ModelOption[]): Array<{ id: string; name: string; slug: string }> {
  const seen = new Set<string>();
  const providers: Array<{ id: string; name: string; slug: string }> = [];

  for (const model of models) {
    if (!seen.has(model.provider.id)) {
      seen.add(model.provider.id);
      providers.push(model.provider);
    }
  }

  return providers;
}

export function getModelsForProvider(models: ModelOption[], providerSlug: string): ModelOption[] {
  return models.filter((m) => m.provider.slug === providerSlug);
}

export function clearModelsCache(): void {
  cache.clear();
}
