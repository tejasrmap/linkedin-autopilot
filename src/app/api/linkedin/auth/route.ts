// ==============================================================
// LINKEDIN AUTOPILOT - OAUTH AUTH/CONNECT ROUTE ALIAS
// BRIDGES /api/linkedin/auth TO /api/linkedin/connect WITH CSRF DEFENSE
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { linkedInClient } from '@/lib/linkedin/client';
import { createOAuthState, getAuthoritativeRedirectUri } from '@/lib/linkedin/oauth-state';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const workspaceId = request.headers.get('x-workspace-id') || searchParams.get('workspaceId');
  const orgAccess = searchParams.get('org') === 'true' || searchParams.get('organization') === 'true';

  const auth = await getAuthContext(workspaceId);
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');

  if (!auth) {
    if (acceptsHtml) {
      return NextResponse.redirect(`${origin}/login?info=login_required`);
    }
    return NextResponse.json({ error: 'Unauthorized: Please log in first' }, { status: 401 });
  }

  // Generate cryptographically secure, session-bound OAuth state
  const { stateParam, cookieName, cookieValue, maxAge } = createOAuthState({
    workspaceId: auth.workspaceId,
    userId: auth.user.id,
  });

  const redirectUri = getAuthoritativeRedirectUri(origin);
  const authUrl = linkedInClient.getAuthorizationUrl(stateParam, orgAccess, redirectUri);

  // If called directly via browser navigation, redirect directly
  if (acceptsHtml) {
    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      name: cookieName,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/api/linkedin/callback',
    });
    return response;
  }

  const response = NextResponse.json({
    url: authUrl,
    redirectUri,
  });

  // Bind state to initiating browser session via HTTP-only secure cookie
  response.cookies.set({
    name: cookieName,
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/api/linkedin/callback',
  });

  return response;
}
