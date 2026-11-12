import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: media, error } = await admin
    .from('media_assets')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enrichedMedia = (media || []).map((m: any) => {
    const { data: urlData } = admin.storage.from('post-assets').getPublicUrl(m.storage_path);
    return {
      ...m,
      url: urlData?.publicUrl || '',
    };
  });

  return NextResponse.json({ media: enrichedMedia });
}

