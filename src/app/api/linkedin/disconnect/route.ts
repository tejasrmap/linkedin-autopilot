import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const DisconnectSchema = z.object({
  accountId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId } = DisconnectSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'admin'].includes(auth.role)) {
      return NextResponse.json({ error: 'Only owners and admins can disconnect accounts.' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('social_accounts')
      .update({
        connection_status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .eq('workspace_id', auth.workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Account disconnected successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

