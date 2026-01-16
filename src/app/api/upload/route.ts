import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { db, media } from '@/lib/db';

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

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

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

    // Validate file size (max 50MB for videos, 10MB for images)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${isVideo ? '50MB' : '10MB'}` },
        { status: 400 }
      );
    }

    const type = isVideo ? 'video' : 'image';
    const id = generateMediaId(type);

    // Get file extension and generate filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'png');
    const storageName = `${id}.${ext}`;
    const path = `library/${storageName}`;

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase storage (in library folder)
    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from('attachments')
      .getPublicUrl(path);

    // Create media record in database
    const [newMedia] = await db
      .insert(media)
      .values({
        id,
        type,
        filename: file.name,
        url: publicUrl.publicUrl,
        mimeType,
        size: file.size,
      })
      .returning();

    return NextResponse.json({
      id: newMedia.id,
      url: newMedia.url,
      filename: newMedia.filename,
      size: newMedia.size,
      type: newMedia.type,
      mimeType: newMedia.mimeType,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
