import { createClient, SupabaseClient } from '@supabase/supabase-js';

// In-memory test store for isolated offline integration testing
const testStore: Record<string, any[]> = {
  stripe_events: [],
  subscriptions: [],
  workspaces: [],
  posts: [],
  social_accounts: [],
  profiles: [],
  ai_generations: [],
  worker_heartbeats: [],
};

export function createAdminClient(): SupabaseClient {
  if (process.env.NODE_ENV !== 'production' && process.env.MOCK_SUPABASE_FOR_TESTS === 'true') {
    return {
      from: (table: string) => {
        let filters: Array<{ col: string; val: any; op?: string }> = [];

        const createQueryBuilder = () => {
          const builder: any = {
            eq: (col: string, val: any) => {
              filters.push({ col, val, op: 'eq' });
              return builder;
            },
            gte: (col: string, val: any) => {
              filters.push({ col, val, op: 'gte' });
              return builder;
            },
            lte: (col: string, val: any) => {
              filters.push({ col, val, op: 'lte' });
              return builder;
            },
            lt: (col: string, val: any) => {
              filters.push({ col, val, op: 'lt' });
              return builder;
            },
            gt: (col: string, val: any) => {
              filters.push({ col, val, op: 'gt' });
              return builder;
            },
            in: (col: string, val: any[]) => {
              filters.push({ col, val, op: 'in' });
              return builder;
            },
            limit: () => builder,
            order: () => builder,
            maybeSingle: async () => {
              if (process.env.SIMULATE_DB_ERROR === 'true') {
                return { data: null, error: { message: 'connection failure: database unreachable', code: '08006' } };
              }
              const rows = testStore[table] || [];
              const match = rows.find((r) => filters.every((f) => {
                if (f.op === 'lte') return r[f.col] <= f.val;
                if (f.op === 'lt') return r[f.col] < f.val;
                if (f.op === 'gte') return r[f.col] >= f.val;
                if (f.op === 'gt') return r[f.col] > f.val;
                if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(r[f.col]);
                return r[f.col] === f.val;
              }));
              return { data: match || null, error: null };
            },
            single: async () => {
              if (process.env.SIMULATE_DB_ERROR === 'true') {
                return { data: null, error: { message: 'connection failure: database unreachable', code: '08006' } };
              }
              const rows = testStore[table] || [];
              const match = rows.find((r) => filters.every((f) => {
                if (f.op === 'lte') return r[f.col] <= f.val;
                if (f.op === 'lt') return r[f.col] < f.val;
                if (f.op === 'gte') return r[f.col] >= f.val;
                if (f.op === 'gt') return r[f.col] > f.val;
                if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(r[f.col]);
                return r[f.col] === f.val;
              }));
              return { data: match || null, error: match ? null : new Error('Not found') };
            },
            then: (resolve: any, reject: any) => {
              if (process.env.SIMULATE_DB_ERROR === 'true') {
                return Promise.resolve({
                  data: null,
                  count: null,
                  error: { message: 'connection failure: database unreachable', code: '08006' },
                }).then(resolve, reject);
              }
              const rows = testStore[table] || [];
              const filtered = rows.filter((r) => filters.every((f) => {
                if (f.op === 'lte') return r[f.col] <= f.val;
                if (f.op === 'lt') return r[f.col] < f.val;
                if (f.op === 'gte') return r[f.col] >= f.val;
                if (f.op === 'gt') return r[f.col] > f.val;
                if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(r[f.col]);
                return r[f.col] === f.val;
              }));
              return Promise.resolve({
                data: filtered,
                count: filtered.length,
                error: null,
              }).then(resolve, reject);
            },
          };
          return builder;
        };

        return {
          select: (cols?: string, opts?: any) => createQueryBuilder(),
          insert: (record: any) => {
            if (process.env.SIMULATE_DB_ERROR === 'true') {
              return {
                data: null,
                error: { message: 'connection failure: database unreachable', code: '08006' },
                select: () => ({
                  maybeSingle: async () => ({ data: null, error: { message: 'connection failure', code: '08006' } }),
                }),
              };
            }
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
          upsert: (record: any) => {
            const rows = (testStore[table] = testStore[table] || []);
            const existingIndex = rows.findIndex((r) => r.id === record.id);
            if (existingIndex >= 0) {
              rows[existingIndex] = { ...rows[existingIndex], ...record };
            } else {
              rows.push({ ...record });
            }
            return {
              data: record,
              error: null,
              select: () => ({
                maybeSingle: async () => ({ data: record, error: null }),
              }),
            };
          },
          update: (record: any) => {
            const updateFilters: Array<{ col: string; val: any; op: 'eq' | 'lte' | 'lt' | 'gte' | 'gt' | 'in' }> = [];
            const matchesFilters = (r: any) => {
              return updateFilters.every((f) => {
                if (f.op === 'lte') return r[f.col] <= f.val;
                if (f.op === 'lt') return r[f.col] < f.val;
                if (f.op === 'gte') return r[f.col] >= f.val;
                if (f.op === 'gt') return r[f.col] > f.val;
                if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(r[f.col]);
                return r[f.col] === f.val;
              });
            };
            const executeUpdate = () => {
              const rows = testStore[table] || [];
              const matches = rows.filter(matchesFilters);
              matches.forEach((m) => Object.assign(m, record));
              return matches;
            };
            const updateBuilder: any = {
              eq: (col: string, val: any) => {
                updateFilters.push({ col, val, op: 'eq' });
                return updateBuilder;
              },
              in: (col: string, val: any[]) => {
                updateFilters.push({ col, val, op: 'in' });
                return updateBuilder;
              },
              lte: (col: string, val: any) => {
                updateFilters.push({ col, val, op: 'lte' });
                return updateBuilder;
              },
              lt: (col: string, val: any) => {
                updateFilters.push({ col, val, op: 'lt' });
                return updateBuilder;
              },
              gte: (col: string, val: any) => {
                updateFilters.push({ col, val, op: 'gte' });
                return updateBuilder;
              },
              gt: (col: string, val: any) => {
                updateFilters.push({ col, val, op: 'gt' });
                return updateBuilder;
              },
              select: () => ({
                maybeSingle: async () => {
                  const rows = testStore[table] || [];
                  const match = rows.find(matchesFilters);
                  if (match) {
                    Object.assign(match, record);
                    return { data: { ...match }, error: null };
                  }
                  return { data: null, error: null };
                },
                single: async () => {
                  const rows = testStore[table] || [];
                  const match = rows.find(matchesFilters);
                  if (match) {
                    Object.assign(match, record);
                    return { data: { ...match }, error: null };
                  }
                  return { data: null, error: new Error('Not found') };
                },
              }),
              then: (resolve: any, reject: any) => {
                const matches = executeUpdate();
                return Promise.resolve({ data: matches, error: null }).then(resolve, reject);
              },
            };
            return updateBuilder;
          },
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
