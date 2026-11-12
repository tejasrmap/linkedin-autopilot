import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decryptToken } from '../src/lib/encryption';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function probeWithAuth() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts } = await admin.from('social_accounts').select('*').limit(1);
  const account = accounts![0];
  const token = decryptToken(account.encrypted_access_token);

  console.log('Testing with real member access token for author:', account.provider_account_id);

  const candidateVersions = [
    '202611', '202610', '202609', '202608', '202607', '202606',
    '202605', '202604', '202603', '202602', '202601'
  ];

  for (const v of candidateVersions) {
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'LinkedIn-Version': v,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: `urn:li:person:${account.provider_account_id}`,
        commentary: 'API version check',
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });

    const body = await res.text();
    const isVersionError = body.includes('not active') || body.includes('NONEXISTENT_VERSION');
    console.log(`Version ${v}: HTTP ${res.status} | Active: ${!isVersionError} -> ${body.slice(0, 100)}`);
    if (!isVersionError) {
      console.log(`>>> SUCCESS ACTIVE VERSION: ${v} <<<`);
      console.log(`Headers:`, Object.fromEntries(res.headers.entries()));
      break;
    }
  }
}

probeWithAuth().catch(console.error);
