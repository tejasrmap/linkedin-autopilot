import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function inspectSchema() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(url, secretKey);

  // Check what tables and columns exist
  const { data: profCols, error: pErr } = await admin.from('profiles').select().limit(1);
  console.log('profiles query:', { data: profCols, error: pErr });

  const { data: wsCols, error: wErr } = await admin.from('workspaces').select().limit(1);
  console.log('workspaces query:', { data: wsCols, error: wErr });
}

inspectSchema().catch(console.error);

