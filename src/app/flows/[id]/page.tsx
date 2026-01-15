import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { FlowDetail } from '@/components/flows/flow-detail';

export default async function FlowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: flow, error } = await supabase
    .from('flows')
    .select(
      `
      *,
      prompts(*)
    `
    )
    .eq('id', id)
    .single();

  if (error || !flow) {
    notFound();
  }

  // Sort prompts by position
  const sortedPrompts = flow.prompts
    ? [...(flow.prompts as Array<{ position?: number }>)].sort(
        (a, b) => (a.position || 0) - (b.position || 0)
      )
    : [];

  return (
    <div className="flex flex-col">
      <Header title={flow.name} />
      <div className="flex-1 p-6">
        <FlowDetail flow={{ ...flow, prompts: sortedPrompts }} />
      </div>
    </div>
  );
}
