import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await admin
    .from('posts')
    .select('id, status, published_at, provider_post_id')
    .eq('id', 'ae41df75-667a-400e-a844-b12dea7a65a2')
    .single();

  console.log('Post after worker publish:', JSON.stringify(data, null, 2));
}

run();

