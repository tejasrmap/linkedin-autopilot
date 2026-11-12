import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const nowIso = new Date().toISOString();
  console.log('Now ISO:', nowIso);

  const { data: dueJobs, error } = await admin
    .from('scheduled_jobs')
    .select('id, post_id, status, scheduled_at')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso);

  console.log('Query result:', { dueJobs, error });
}

run();
