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
import { Loader2, Check, Search, Film } from 'lucide-react';
import type { Media } from '@/lib/db/schema';

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (items: { id: string; url: string }[]) => void;
  multiple?: boolean;
}

export function MediaPicker({ open, onOpenChange, onSelect, multiple = true }: MediaPickerProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      fetchMedia();
      setSelected(new Set());
    }
  }, [open]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        setMedia(data);
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMedia = media.filter((item) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      item.id.toLowerCase().includes(searchLower) ||
      item.filename?.toLowerCase().includes(searchLower)
    );
  });

  const toggleSelect = (item: Media) => {
    if (multiple) {
      const newSelected = new Set(selected);
      if (newSelected.has(item.id)) {
        newSelected.delete(item.id);
      } else {
        newSelected.add(item.id);
      }
      setSelected(newSelected);
    } else {
      // Single select - immediately confirm
      onSelect([{ id: item.id, url: item.url }]);
      onOpenChange(false);
    }
  };

  const handleConfirm = () => {
    const selectedItems = media
      .filter((item) => selected.has(item.id))
      .map((item) => ({ id: item.id, url: item.url }));
    onSelect(selectedItems);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select from Library</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              {search ? 'No media found matching your search' : 'No media in library'}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 p-1">
              {filteredMedia.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelect(item)}
                  className={`relative aspect-square rounded-lg border-2 overflow-hidden transition-all ${
                    selected.has(item.id)
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  {item.type === 'video' ? (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.filename || item.id}
                      className="w-full h-full object-cover"
                    />
                  )}
                  {selected.has(item.id) && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <div className="rounded-full bg-primary p-1">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-[10px] text-white truncate">{item.id}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {multiple && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {selected.size} item{selected.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={selected.size === 0}>
                Add Selected
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
