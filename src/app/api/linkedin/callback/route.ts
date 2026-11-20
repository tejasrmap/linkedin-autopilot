// ==============================================================
// LINKEDIN AUTOPILOT - OAUTH CALLBACK & CREDENTIAL PERSISTENCE
// VALIDATES SESSION-BOUND CSRF DEFENSE, WORKSPACE MEMBERSHIP & SECURE TOKENS
// BY GT INNOX LLP
// ==============================================================

import { linkedInClient } from '@/lib/linkedin/client';
import { encryptToken } from '@/lib/encryption';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/auth';
import { verifyOAuthState, getAuthoritativeRedirectUri } from '@/lib/linkedin/oauth-state';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const pair of cookieHeader.split(';')) {
    const [rawKey, ...valParts] = pair.trim().split('=');
    if (rawKey) {
      map[rawKey.trim()] = decodeURIComponent(valParts.join('='));
    }
  }
  return map;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const redirectBase = getAuthoritativeRedirectUri(origin).replace('/api/linkedin/callback', '');

  if (error) {
    console.error('[LinkedIn OAuth] Provider returned error:', error, errorDescription);
    return NextResponse.redirect(`${redirectBase}/accounts?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${redirectBase}/accounts?error=missing_code`);
  }

  // 1. Validate Session-Bound Cryptographic OAuth State
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);

  const stateValidation = verifyOAuthState({
    stateParam: state,
    getCookie: (name) => cookies[name],
  });

  const clearCookieOnResponse = (response: NextResponse) => {
    if (stateValidation.cookieNameToClear) {
      response.cookies.set({
        name: stateValidation.cookieNameToClear,
        value: '',
        maxAge: 0,
        path: '/api/linkedin/callback',
      });
    }
  };

  if (!stateValidation.isValid || !stateValidation.payload) {
    console.warn('[LinkedIn OAuth Security] State validation rejected:', stateValidation.error);
    const res = NextResponse.redirect(
      `${redirectBase}/accounts?error=${encodeURIComponent(stateValidation.error || 'invalid_or_expired_state')}`
    );
    clearCookieOnResponse(res);
    return res;
  }

  const { workspaceId, userId } = stateValidation.payload;

  // 2. Validate Active Authenticated Browser Session
  const currentAuth = await getAuthContext();
  if (!currentAuth) {
    console.warn('[LinkedIn OAuth Security] Callback executed without active auth session.');
    const res = NextResponse.redirect(`${redirectBase}/accounts?error=unauthorized_session`);
    clearCookieOnResponse(res);
    return res;
  }

  // 3. Prevent Login CSRF: Authenticated user must match the user who initiated the flow
  if (currentAuth.user.id !== userId) {
    console.warn('[LinkedIn OAuth Security] State user mismatch:', {
      stateUser: userId,
      sessionUser: currentAuth.user.id,
    });
    const res = NextResponse.redirect(`${redirectBase}/accounts?error=user_session_mismatch`);
    clearCookieOnResponse(res);
    return res;
  }

  // 4. Validate Workspace Membership: Authenticated user must still belong to target workspace
  const admin = createAdminClient();
  const isTargetCurrent = currentAuth.workspaceId === workspaceId;

  const { data: memberRecord } = await admin
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', currentAuth.user.id)
    .maybeSingle();

  if (!isTargetCurrent && !memberRecord) {
    console.warn('[LinkedIn OAuth Security] Workspace membership not authorized:', {
      workspaceId,
      userId: currentAuth.user.id,
    });
    const res = NextResponse.redirect(`${redirectBase}/accounts?error=workspace_membership_revoked`);
    clearCookieOnResponse(res);
    return res;
  }

  try {
    // 5. Exchange code for access token using authoritative redirect URI
    const callbackRedirectUri = getAuthoritativeRedirectUri(origin);
    const tokenData = await linkedInClient.exchangeCodeForToken(code, callbackRedirectUri);

    // 6. Fetch authenticated member profile
    const userInfo = await linkedInClient.getUserInfo(tokenData.access_token);

    // 7. Encrypt the access token
    const encryptedToken = encryptToken(tokenData.access_token);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const scopes = tokenData.scope
      ? tokenData.scope.split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];

    const hasPublishPermission = scopes.includes('w_member_social');
    const memberConnectionStatus = hasPublishPermission ? 'active' : 'limited_permissions';

    // 8. Upsert member account in social_accounts
    const { error: upsertErr } = await admin.from('social_accounts').upsert(
      {
        workspace_id: workspaceId,
        provider: 'linkedin',
        provider_account_id: userInfo.sub,
        account_name: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || 'LinkedIn Member',
        account_type: 'member',
        encrypted_access_token: encryptedToken,
        token_expires_at: tokenExpiresAt,
        scopes: scopes,
        connection_status: memberConnectionStatus,
        profile_image_url: userInfo.picture || null,
        metadata: {
          email: userInfo.email,
          connected_by: userId,
          has_publish_scope: hasPublishPermission,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'workspace_id,provider,provider_account_id',
      }
    );

    if (upsertErr) {
      console.error('[LinkedIn OAuth] Error saving LinkedIn account to database:', JSON.stringify(upsertErr));
      const res = NextResponse.redirect(`${redirectBase}/accounts?error=database_error`);
      clearCookieOnResponse(res);
      return res;
    }

    // Sync profile picture to profiles table for the connected user
    if (userInfo.picture && userId) {
      try {
        await admin.from('profiles').update({ avatar_url: userInfo.picture }).eq('id', userId);
      } catch (err) {
        console.warn('Failed to sync avatar_url to profiles:', err);
      }
    }

    // 9. Discover organizations where member is an admin
    try {
      const orgs = await linkedInClient.getOrganizations(tokenData.access_token);
      for (const org of orgs) {
        await admin.from('social_accounts').upsert(
          {
            workspace_id: workspaceId,
            provider: 'linkedin',
            provider_account_id: org.id,
            account_name: org.name,
            account_type: 'organization',
            encrypted_access_token: encryptedToken,
            token_expires_at: tokenExpiresAt,
            scopes: scopes,
            connection_status: 'active',
            profile_image_url: org.logoUrl || null,
            metadata: {
              organization_urn: org.urn,
              connected_by: userId,
            },
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'workspace_id,provider,provider_account_id',
          }
        );
      }
    } catch (orgErr) {
      console.warn('Organization auto-discovery skipped:', orgErr);
    }

    // 10. Create success notification (non-blocking)
    try {
      await admin.from('notifications').insert({
        workspace_id: workspaceId,
        user_id: userId,
        title: 'LinkedIn Account Connected! 🎉',
        message: `Successfully connected "${userInfo.name}" to your workspace.`,
        type: 'success',
      });
    } catch (notifErr) {
      console.warn('Notification insert skipped:', notifErr);
    }

    // Success response: Clear state cookie
    const successRes = NextResponse.redirect(`${redirectBase}/accounts?connected=true`);
    clearCookieOnResponse(successRes);
    return successRes;
  } catch (err: any) {
    console.error('[LinkedIn OAuth] Callback exception:', err);
    const errRes = NextResponse.redirect(`${redirectBase}/accounts?error=${encodeURIComponent(err.message)}`);
    clearCookieOnResponse(errRes);
    return errRes;
  }
}
