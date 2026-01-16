import { NextRequest, NextResponse } from 'next/server';
import { db, media } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { createServiceClient } from '@/lib/supabase/server';

// GET /api/media/[id] - Get single media item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [item] = await db
      .select()
      .from(media)
      .where(eq(media.id, id));

    if (!item) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

// DELETE /api/media/[id] - Delete media item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Get the media item first to get the filename
    const [item] = await db
      .select()
      .from(media)
      .where(eq(media.id, id));

    if (!item) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Delete from storage
    const supabase = createServiceClient();
    const ext = item.filename.split('.').pop() || 'png';
    const storagePath = `library/${id}.${ext}`;

    await supabase.storage
      .from('attachments')
      .remove([storagePath]);

    // Delete from database
    await db.delete(media).where(eq(media.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting media:', error);
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
