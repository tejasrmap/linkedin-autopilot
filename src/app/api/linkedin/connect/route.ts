import { getAuthContext } from '@/lib/auth';
import { linkedInClient } from '@/lib/linkedin/client';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');
  const orgAccess = searchParams.get('org') === 'true';

  const auth = await getAuthContext(workspaceId);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Construct secure state containing workspaceId, userId, and nonce
  const statePayload = {
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
    nonce: Math.random().toString(36).substring(2),
    timestamp: Date.now(),
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
  const dynamicRedirectUri = `${origin}/api/linkedin/callback`;
  const authUrl = linkedInClient.getAuthorizationUrl(state, orgAccess, dynamicRedirectUri);

  return NextResponse.json({ url: authUrl, redirectUri: dynamicRedirectUri });
}

