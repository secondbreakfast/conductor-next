import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { ModelsSettingsPage } from '@/components/settings/models-settings-page';

export default async function SettingsModelsPage() {
  const supabase = await createClient();

  const { data: providers } = await supabase
    .from('providers')
    .select(`
      *,
      models(*)
    `)
    .order('display_order', { ascending: true });

  const sortedProviders = (providers || []).map((provider) => ({
    ...provider,
    models: (provider.models as Array<{ display_order: number }> || []).sort(
      (a, b) => a.display_order - b.display_order
    ),
  }));

  return (
    <div className="flex flex-col">
      <Header title="Model Configuration" />
      <ModelsSettingsPage providers={sortedProviders} />
    </div>
  );
}
