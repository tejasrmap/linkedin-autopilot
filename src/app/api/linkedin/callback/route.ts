import { linkedInClient } from '@/lib/linkedin/client';
import { encryptToken } from '@/lib/encryption';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthContext } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error('LinkedIn OAuth returned error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/accounts?error=${encodeURIComponent(errorDescription || error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/accounts?error=missing_code`);
  }

  // Decode and validate state, with fallback to active auth session
  let workspaceId = '';
  let userId = '';

  if (state) {
    try {
      const statePayload = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      if (Date.now() - statePayload.timestamp <= 15 * 60 * 1000) {
        workspaceId = statePayload.workspaceId;
        userId = statePayload.userId;
      }
    } catch (e) {
      // Fallback
    }
  }

  if (!workspaceId) {
    const auth = await getAuthContext();
    if (auth) {
      workspaceId = auth.workspaceId;
      userId = auth.user.id;
    } else {
      return NextResponse.redirect(`${origin}/accounts?error=invalid_or_expired_state`);
    }
  }

  try {
    // 1. Exchange code for access token using request origin redirect URI
    const callbackRedirectUri = `${origin}/api/linkedin/callback`;
    const tokenData = await linkedInClient.exchangeCodeForToken(code, callbackRedirectUri);

    // 2. Fetch authenticated member's profile
    const userInfo = await linkedInClient.getUserInfo(tokenData.access_token);

    // 3. Encrypt the access token
    const encryptedToken = encryptToken(tokenData.access_token);
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const scopes = tokenData.scope ? tokenData.scope.split(' ') : ['openid', 'profile', 'email', 'w_member_social'];

    const admin = createAdminClient();

    // 4. Upsert member account in social_accounts
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
        connection_status: 'active',
        profile_image_url: userInfo.picture || null,
        metadata: {
          email: userInfo.email,
          connected_by: userId,
        },
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'workspace_id,provider,provider_account_id',
      }
    );

    if (upsertErr) {
      console.error('Error saving LinkedIn account to database:', JSON.stringify(upsertErr));
      return NextResponse.redirect(`${origin}/accounts?error=database_error`);
    }

    // 5. Try discovering organizations where member is an admin
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

    // 6. Create success notification (non-blocking)
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

    return NextResponse.redirect(`${origin}/accounts?connected=true`);
  } catch (err: any) {
    console.error('LinkedIn Callback exception:', err);
    return NextResponse.redirect(`${origin}/accounts?error=${encodeURIComponent(err.message)}`);
  }
}

