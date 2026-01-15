import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { NewRunForm } from '@/components/runs/new-run-form';

export default async function NewRunPage() {
  const supabase = await createClient();

  // Fetch available flows
  const { data: flows } = await supabase
    .from('flows')
    .select('id, name, description')
    .order('name');

  return (
    <div className="flex flex-col">
      <Header title="New Run" />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-2xl">
          <NewRunForm flows={flows || []} />
        </div>
      </div>
    </div>
  );
}
