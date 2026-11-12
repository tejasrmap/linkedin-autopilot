import { createAdminClient } from '../src/lib/supabase/admin';
import { decryptToken } from '../src/lib/encryption';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function auditLinkedInPermissions() {
  console.log('=== AUDITING LINKEDIN ACCOUNTS & ORG PERMISSIONS ===');
  const admin = createAdminClient();
  const { data: accounts, error } = await admin.from('social_accounts').select('*');
  
  if (error) {
    console.error('Failed to query social_accounts:', error);
    return;
  }
  
  console.log(`Found ${accounts?.length || 0} connected social accounts:`);
  for (const acc of accounts || []) {
    console.log(`- [${acc.account_type}] ${acc.account_name} (ID: ${acc.provider_account_id})`);
    console.log(`  Scopes granted: ${JSON.stringify(acc.scopes)}`);
    
    const token = decryptToken(acc.encrypted_access_token);
    if (!token) {
      console.log('  Could not decrypt token');
      continue;
    }

    // 1. Probe personal userinfo
    try {
      const uRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`  Member userinfo HTTP status: ${uRes.status}`);
      if (uRes.ok) {
        const uData = await uRes.json();
        console.log(`  Verified Member Name: ${uData.name}, Sub: ${uData.sub}`);
      }
    } catch (e: any) {
      console.log(`  userinfo error: ${e.message}`);
    }

    // 2. Probe organizationalEntityAcls (v2)
    try {
      const orgRes = await fetch('https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee', {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Restli-Protocol-Version': '2.0.0',
        }
      });
      console.log(`  organizationalEntityAcls (v2) HTTP status: ${orgRes.status}`);
      const text = await orgRes.text();
      console.log(`  Response: ${text.substring(0, 300)}`);
    } catch (e: any) {
      console.log(`  v2 org ACL error: ${e.message}`);
    }

    // 3. Probe organizationAcls (rest)
    try {
      const restOrgRes = await fetch('https://api.linkedin.com/rest/organizationAcls?q=roleAssignee', {
        headers: {
          Authorization: `Bearer ${token}`,
          'LinkedIn-Version': '202610',
          'X-Restli-Protocol-Version': '2.0.0',
        }
      });
      console.log(`  organizationAcls (rest 202610) HTTP status: ${restOrgRes.status}`);
      const text = await restOrgRes.text();
      console.log(`  Response: ${text.substring(0, 300)}`);
    } catch (e: any) {
      console.log(`  rest org ACL error: ${e.message}`);
    }
  }
}

auditLinkedInPermissions().catch(console.error);
