import { createClient, SupabaseClient } from '@supabase/supabase-js';

// In-memory test store for isolated offline integration testing
const testStore: Record<string, any[]> = {
  stripe_events: [],
  subscriptions: [],
  workspaces: [],
};

export function createAdminClient(): SupabaseClient {
  if (process.env.NODE_ENV !== 'production' && process.env.MOCK_SUPABASE_FOR_TESTS === 'true') {
    return {
      from: (table: string) => {
        let filters: Array<{ col: string; val: any }> = [];
        return {
          select: (cols?: string) => ({
            eq: (col: string, val: any) => {
              filters.push({ col, val });
              return {
                maybeSingle: async () => {
                  const rows = testStore[table] || [];
                  const match = rows.find((r) => filters.every((f) => r[f.col] === f.val));
                  return { data: match || null, error: null };
                },
                single: async () => {
                  const rows = testStore[table] || [];
                  const match = rows.find((r) => filters.every((f) => r[f.col] === f.val));
                  return { data: match || null, error: match ? null : new Error('Not found') };
                },
              };
            },
          }),
          insert: (record: any) => {
            const rows = (testStore[table] = testStore[table] || []);
            // Check unique constraint on event_id if stripe_events
            if (table === 'stripe_events' && rows.some((r) => r.event_id === record.event_id)) {
              return {
                data: null,
                error: {
                  message: 'duplicate key value violates unique constraint "idx_stripe_events_event_id"',
                  code: '23505',
                },
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { message: 'duplicate key', code: '23505' },
                  }),
                }),
              };
            }
            rows.push({ ...record, id: record.id || `mock_${Date.now()}` });
            return {
              data: record,
              error: null,
              select: () => ({
                maybeSingle: async () => ({ data: record, error: null }),
              }),
            };
          },
          update: (record: any) => ({
            eq: (col: string, val: any) => {
              const rows = testStore[table] || [];
              const match = rows.find((r) => r[col] === val);
              if (match) {
                Object.assign(match, record);
              }
              return {
                select: () => ({
                  maybeSingle: async () => ({ data: match || record, error: null }),
                }),
              };
            },
          }),
        };
      },
    } as unknown as SupabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder-service-role-key';

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
