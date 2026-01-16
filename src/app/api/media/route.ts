import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { db, media } from '@/lib/db';
import { desc } from 'drizzle-orm';

// Generate custom ID: img_xxxxxxxx or vdo_xxxxxxxx
function generateMediaId(type: 'image' | 'video'): string {
  const prefix = type === 'image' ? 'img' : 'vdo';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${id}`;
}

// GET /api/media - List all media
export async function GET() {
  try {
    const items = await db
      .select()
      .from(media)
      .orderBy(desc(media.createdAt));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching media:', error);
    return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
  }
}

// POST /api/media - Upload new media
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Determine type from mime type
    const mimeType = file.type;
    const isVideo = mimeType.startsWith('video/');
    const isImage = mimeType.startsWith('image/');

    if (!isVideo && !isImage) {
      return NextResponse.json(
        { error: 'File must be an image or video' },
        { status: 400 }
      );
    }

    const type = isVideo ? 'video' : 'image';
    const id = generateMediaId(type);

    // Get file extension
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'png');
    const filename = `${id}.${ext}`;

    // Upload to Supabase Storage
    const supabase = createServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(`library/${filename}`, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(`library/${filename}`);

    const url = urlData.publicUrl;

    // Insert into database
    const [newMedia] = await db
      .insert(media)
      .values({
        id,
        type,
        filename: file.name,
        url,
        mimeType,
        size: file.size,
      })
      .returning();

    return NextResponse.json(newMedia, { status: 201 });
  } catch (error) {
    console.error('Error uploading media:', error);
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 });
  }
}
