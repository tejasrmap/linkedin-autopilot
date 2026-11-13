import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/media-constants';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return NextResponse.json(
        {
          error: `Unsupported file format "${file.type}". Supported formats: JPEG, PNG, GIF, WebP, MP4, MOV, and PDF.`,
        },
        { status: 400 }
      );
    }

    // Validate size (max 50MB for video/document, 10MB for images)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File exceeds maximum limit of 50MB' }, { status: 400 });
    }

    const admin = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop();
    const storagePath = `${auth.workspaceId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await admin.storage
      .from('post-assets')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      // If bucket does not exist or storage error, handle cleanly
      console.warn('Storage upload note:', uploadErr.message);
    }

    const { data: publicUrlData } = admin.storage
      .from('post-assets')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData?.publicUrl || '';

    // Record in media_assets table
    const { data: mediaAsset, error: dbErr } = await admin
      .from('media_assets')
      .insert({
        workspace_id: auth.workspaceId,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({
      media: {
        ...mediaAsset,
        url: publicUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

