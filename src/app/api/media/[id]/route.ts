import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: media } = await admin
    .from('media_assets')
    .select('storage_path')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (media?.storage_path) {
    await admin.storage.from('post-assets').remove([media.storage_path]);
  }

  const { error } = await admin
    .from('media_assets')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

