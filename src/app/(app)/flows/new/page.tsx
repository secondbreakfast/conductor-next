'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateSlug } from '@/lib/slug';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewFlowPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!slugTouched && name.trim()) {
      setSlug(generateSlug(name));
    }
  }, [name, slugTouched]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a flow name');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flow: {
            name: name.trim(),
            description: description.trim() || null,
            slug: slug.trim() || null,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Flow created');
        router.push(`/flows/${data.slug || data.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create flow');
      }
    } catch (error) {
      toast.error('Failed to create flow');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header title="New Flow" />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-xl">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <Link href="/flows">
                <Button variant="ghost" size="sm" type="button">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Flows
                </Button>
              </Link>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Create New Flow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Image Processing Flow"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this flow does..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Slug
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSlugTouched(true);
                    }}
                    placeholder="my-flow-name"
                  />
                  {slug && (
                    <p className="text-xs text-muted-foreground">
                      URL: /flows/{slug}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Link href="/flows">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Flow'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
