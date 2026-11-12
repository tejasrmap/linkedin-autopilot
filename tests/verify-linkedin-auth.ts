import { config } from 'dotenv';
config({ path: '.env.local' });

async function verifyCredentials() {
  console.log('----------------------------------------------------');
  console.log('🔍 Testing LinkedIn Credentials against Live OAuth Servers');
  console.log('----------------------------------------------------');

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3000/api/linkedin/callback';

  console.log('Client ID:', clientId);
  console.log('Redirect URI:', redirectUri);

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: 'test_auth_code_for_handshake_audit',
    redirect_uri: redirectUri,
    client_id: clientId || '',
    client_secret: clientSecret || '',
  });

  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    console.log('LinkedIn Server HTTP Status:', res.status);
    console.log('LinkedIn Server Response:', JSON.stringify(data, null, 2));

    if (data.error === 'invalid_client') {
      console.error('❌ LinkedIn rejected Client ID or Secret: invalid_client');
      process.exit(1);
    } else if (
      data.error === 'invalid_grant' ||
      (data.error_description && data.error_description.includes('code'))
    ) {
      console.log('----------------------------------------------------');
      console.log('✅ SUCCESS! Client ID and Client Secret Authenticated by LinkedIn!');
      console.log('   LinkedIn accepted the credentials and responded with invalid_grant');
      console.log('   (because the authorization code was a test string).');
      console.log('----------------------------------------------------');
      process.exit(0);
    } else {
      console.log('LinkedIn response:', data);
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Network error during LinkedIn verification:', err.message);
    process.exit(1);
  }
}

verifyCredentials();

