import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function probeVersions() {
  const versions = ['202410', '202411', '202412', '202501', '202502', '202503', '202504', '202505', '202506', '202507', '202508', '202509', '202510', '202511', '202512'];
  
  for (const v of versions) {
    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        'LinkedIn-Version': v,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    const body = await res.text();
    const isVersionError = body.includes('is not active') || body.includes('NONEXISTENT_VERSION');
    console.log(`Version ${v} -> HTTP ${res.status} | Active: ${!isVersionError}`);
  }
}

probeVersions().catch(console.error);
