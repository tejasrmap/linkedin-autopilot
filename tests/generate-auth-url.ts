import { config } from 'dotenv';
config({ path: '.env.local' });
import { LinkedInClient } from '../src/lib/linkedin/client';

const client = new LinkedInClient();
const state = Buffer.from(JSON.stringify({ workspaceId: 'default', timestamp: Date.now() })).toString('base64url');
const url = client.getAuthorizationUrl(state, false);

console.log('----------------------------------------------------');
console.log('🔗 Official LinkedIn Authorization Connect URL:');
console.log('----------------------------------------------------');
console.log(url);
console.log('----------------------------------------------------');

