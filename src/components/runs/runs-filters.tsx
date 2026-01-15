'use client';

import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Flow {
  id: string;
  name: string;
}

interface RunsFiltersProps {
  flows?: Flow[];
  initialParams?: {
    status?: string;
    flow_id?: string;
    sort_by?: string;
    sort_order?: string;
  };
}

export function RunsFilters({ flows = [], initialParams = {} }: RunsFiltersProps) {
  const router = useRouter();

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams();

    // Preserve existing params
    if (initialParams.status && key !== 'status') params.set('status', initialParams.status);
    if (initialParams.flow_id && key !== 'flow_id') params.set('flow_id', initialParams.flow_id);
    if (initialParams.sort_by && key !== 'sort_by') params.set('sort_by', initialParams.sort_by);
    if (initialParams.sort_order && key !== 'sort_order') params.set('sort_order', initialParams.sort_order);

    // Set new value
    if (value) {
      params.set(key, value);
    }

    const queryString = params.toString();
    router.push(queryString ? `/runs?${queryString}` : '/runs');
  };

  const clearFilters = () => {
    router.push('/runs');
  };

  const hasFilters =
    initialParams.status || initialParams.flow_id || (initialParams.sort_by && initialParams.sort_by !== 'created_at');

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4">
      {/* Status Filter */}
      <Select
        value={initialParams.status || ''}
        onValueChange={(value) => updateFilter('status', value || null)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="timed-out">Timed Out</SelectItem>
        </SelectContent>
      </Select>

      {/* Flow Filter */}
      <Select
        value={initialParams.flow_id || ''}
        onValueChange={(value) => updateFilter('flow_id', value || null)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Flow" />
        </SelectTrigger>
        <SelectContent>
          {flows.map((flow) => (
            <SelectItem key={flow.id} value={flow.id}>
              {flow.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort By */}
      <Select
        value={initialParams.sort_by || 'created_at'}
        onValueChange={(value) => updateFilter('sort_by', value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">Created</SelectItem>
          <SelectItem value="updated_at">Updated</SelectItem>
          <SelectItem value="status">Status</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort Order */}
      <Select
        value={initialParams.sort_order || 'desc'}
        onValueChange={(value) => updateFilter('sort_order', value)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Newest</SelectItem>
          <SelectItem value="asc">Oldest</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
