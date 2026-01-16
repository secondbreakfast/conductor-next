'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, Film, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  filename: string;
  url: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

export default function LibraryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch media on mount
  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const response = await fetch('/api/media');
      if (response.ok) {
        const data = await response.json();
        setMedia(data);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);

    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/media', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const newMedia = await response.json();
          setMedia((prev) => [newMedia, ...prev]);
          toast.success(`Uploaded ${file.name}`);
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to upload');
        }
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold">Library</h1>
        <p className="text-sm text-muted-foreground">
          Upload and manage your images and videos
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={cn(
            'relative mb-8 flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
            isUploading && 'pointer-events-none opacity-50'
          )}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <>
              <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
              <p className="mt-4 text-lg font-medium">Uploading...</p>
            </>
          ) : isDragActive ? (
            <>
              <Upload className="h-12 w-12 text-primary" />
              <p className="mt-4 text-lg font-medium text-primary">
                Drop files here
              </p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-medium">
                Drag & drop files here
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                or click to browse
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Supports images (PNG, JPG, GIF, WebP) and videos (MP4, MOV, WebM)
              </p>
            </>
          )}
        </div>

        {/* Gallery Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">No media yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload some images or videos to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {media.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-lg bg-muted"
              >
                {item.type === 'image' ? (
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                    <div className="absolute bottom-2 left-2">
                      <Film className="h-4 w-4 text-white drop-shadow-lg" />
                    </div>
                  </div>
                )}
                {/* Overlay with ID */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="truncate text-xs font-medium text-white">
                    {item.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
