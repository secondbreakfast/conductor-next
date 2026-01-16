import { notFound } from 'next/navigation';
import { db, media } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { MediaDetail } from '@/components/library/media-detail';

export default async function MediaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [item] = await db
    .select()
    .from(media)
    .where(eq(media.id, id));

  if (!item) {
    notFound();
  }

  return <MediaDetail media={item} />;
}
