import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { decryptToken } from '../src/lib/encryption';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testImageUpload() {
  console.log('==================================================');
  console.log('🖼️ TESTING LINKEDIN IMAGE REGISTRATION & UPLOAD');
  console.log('==================================================');

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: accounts } = await admin.from('social_accounts').select('*').limit(1);
  const account = accounts![0];
  const token = decryptToken(account.encrypted_access_token);
  const authorUrn = `urn:li:person:${account.provider_account_id}`;
  const apiVersion = process.env.LINKEDIN_API_VERSION || '202610';

  console.log('Author URN:', authorUrn);
  console.log('API Version:', apiVersion);

  // 1. Initialize image upload
  console.log('Step 1: Calling action=initializeUpload on /rest/images...');
  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': apiVersion,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: authorUrn,
      },
    }),
  });

  const initBody = await initRes.text();
  console.log(`Init Response: HTTP ${initRes.status}`);
  if (!initRes.ok) {
    console.error('Image init failed:', initBody);
    process.exit(1);
  }

  const initData = JSON.parse(initBody);
  const uploadUrl = initData.value.uploadUrl;
  const imageUrn = initData.value.image;
  console.log('✅ Image Initialized successfully!');
  console.log('Image URN:', imageUrn);
  console.log('Upload URL:', uploadUrl.slice(0, 80) + '...');

  // 2. Upload binary 1x1 PNG pixel
  console.log('Step 2: Uploading binary image payload...');
  const png1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzc1R4ZAAAAABJRU5ErkJggg==',
    'base64'
  );

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/png',
    },
    body: new Uint8Array(png1x1),
  });

  console.log(`Binary Upload Response: HTTP ${uploadRes.status} ${uploadRes.statusText}`);
  if (uploadRes.status === 200 || uploadRes.status === 201) {
    console.log('✅ Image binary uploaded successfully to LinkedIn CDN!');
    console.log('Verified Image URN:', imageUrn);
  } else {
    const errText = await uploadRes.text();
    console.error('Image binary upload failed:', errText);
    process.exit(1);
  }
}

testImageUpload().catch(console.error);

