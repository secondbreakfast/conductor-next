'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Save, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [showKeys, setShowKeys] = useState(false);

  // In a real app, these would be managed server-side
  // This is just for UI demonstration
  const apiKeys = [
    { name: 'OpenAI', env: 'OPENAI_API_KEY', configured: true },
    { name: 'Anthropic', env: 'ANTHROPIC_API_KEY', configured: true },
    { name: 'Gemini', env: 'GEMINI_API_KEY', configured: true },
    { name: 'Stability AI', env: 'STABILITY_API_KEY', configured: true },
    { name: 'Google Cloud Project ID', env: 'GOOGLE_CLOUD_PROJECT_ID', configured: false },
  ];

  return (
    <div className="flex flex-col">
      <Header title="Settings" />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* API Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Configure your AI provider API keys. These are stored as environment variables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div key={key.env} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{key.name}</p>
                      <code className="text-xs text-muted-foreground">{key.env}</code>
                    </div>
                    <Badge variant={key.configured ? 'default' : 'secondary'}>
                      {key.configured ? (
                        <>
                          <Check className="mr-1 h-3 w-3" />
                          Configured
                        </>
                      ) : (
                        <>
                          <X className="mr-1 h-3 w-3" />
                          Not Set
                        </>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  API keys should be configured as environment variables in your deployment platform
                  (e.g., Vercel, Railway, or your hosting provider). For local development, add them
                  to your <code>.env.local</code> file.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Supabase Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Database Configuration</CardTitle>
              <CardDescription>
                Your Supabase database connection settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Supabase URL</p>
                    <code className="text-xs text-muted-foreground">NEXT_PUBLIC_SUPABASE_URL</code>
                  </div>
                  <Badge variant="secondary">Required</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Supabase Anon Key</p>
                    <code className="text-xs text-muted-foreground">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                  </div>
                  <Badge variant="secondary">Required</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Supabase Service Role Key</p>
                    <code className="text-xs text-muted-foreground">SUPABASE_SERVICE_ROLE_KEY</code>
                  </div>
                  <Badge variant="secondary">Required</Badge>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  To set up your Supabase database:
                </p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                  <li>Create a new project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a></li>
                  <li>Run the schema.sql file in the SQL Editor</li>
                  <li>Copy your project URL and keys from Settings &gt; API</li>
                  <li>Add them to your environment variables</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Webhook Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Settings</CardTitle>
              <CardDescription>
                Configure webhook behavior for run status updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-timeout">Webhook Timeout (ms)</Label>
                  <Input
                    id="webhook-timeout"
                    type="number"
                    defaultValue={30000}
                    placeholder="30000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum time to wait for webhook delivery
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook-retries">Max Retries</Label>
                  <Input
                    id="webhook-retries"
                    type="number"
                    defaultValue={3}
                    placeholder="3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of retry attempts for failed webhooks
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <Button onClick={() => toast.info('Settings saved (demo)')}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle>About Conductor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Conductor is an AI image processing platform that orchestrates multiple AI models to upscale, transform, and generate images and videos.</p>
                <p className="font-medium text-foreground">Version 2.0 (Next.js)</p>
                <p>Built with Next.js, Supabase, Tailwind CSS, and shadcn/ui</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
