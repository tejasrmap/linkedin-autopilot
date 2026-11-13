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
  scheduler_execution_logs: [],
  post_publish_attempts: [],
  scheduled_jobs: [],
};

export function createAdminClient(): SupabaseClient {
  if (process.env.NODE_ENV !== 'production' && process.env.MOCK_SUPABASE_FOR_TESTS === 'true') {
    return {
      rpc: async (fnName: string, params: any) => {
        if (process.env.SIMULATE_DB_ERROR === 'true') {
          return { data: null, error: { message: 'connection failure: database unreachable', code: '08006' } };
        }

        const now = new Date();
        const nowIso = now.toISOString();

        if (fnName === 'claim_post_for_publishing') {
          const posts = testStore.posts || [];
          const post = posts.find((p) => p.id === params.target_post_id);
          if (!post) {
            return { data: { success: false, reason: 'post_not_found' }, error: null };
          }

          const isEligible = ['scheduled', 'approved', 'draft'].includes(post.status);
          const isStale =
            post.status === 'processing' &&
            ((post.lease_expires_at && new Date(post.lease_expires_at).getTime() < now.getTime()) ||
              (!post.lease_expires_at &&
                post.updated_at &&
                new Date(post.updated_at).getTime() < now.getTime() - 5 * 60 * 1000));

          if (!isEligible && !isStale) {
            return { data: { success: false, reason: 'already_processing_or_completed' }, error: null };
          }

          const leaseUntil = new Date(
            now.getTime() + (params.lease_duration_seconds || 300) * 1000
          ).toISOString();

          post.status = 'processing';
          post.claim_token = params.new_claim_token;
          post.lease_expires_at = leaseUntil;
          post.updated_at = nowIso;

          const jobs = testStore.scheduled_jobs || [];
          const job = jobs.find((j) => j.post_id === params.target_post_id);
          if (job) {
            job.status = 'processing';
            job.claim_token = params.new_claim_token;
            job.lease_expires_at = leaseUntil;
            job.updated_at = nowIso;
          }

          return {
            data: {
              success: true,
              post_id: post.id,
              claim_token: post.claim_token,
              lease_expires_at: post.lease_expires_at,
            },
            error: null,
          };
        }

        if (fnName === 'handle_publishing_failure_and_retry') {
          const posts = testStore.posts || [];
          const post = posts.find((p) => p.id === params.target_post_id);
          if (!post) {
            return { data: { success: false, reason: 'post_not_found' }, error: null };
          }

          if (post.status === 'published') {
            return { data: { success: false, reason: 'post_already_published' }, error: null };
          }

          if (
            params.expected_claim_token &&
            post.claim_token &&
            post.claim_token !== params.expected_claim_token
          ) {
            return { data: { success: false, reason: 'claim_token_mismatch_lease_lost' }, error: null };
          }

          const jobs = testStore.scheduled_jobs || [];
          const job = jobs.find((j) => j.post_id === params.target_post_id);
          const nextAttempt = ((job?.attempts ?? 0) as number) + 1;
          const maxAttempts = params.max_attempts || 3;

          if (nextAttempt < maxAttempts) {
            const backoffMinutes = Math.pow(2, nextAttempt);
            const retryAtIso = new Date(now.getTime() + backoffMinutes * 60 * 1000).toISOString();

            post.status = 'scheduled';
            post.scheduled_at = retryAtIso;
            post.claim_token = null;
            post.lease_expires_at = null;
            post.error_message = `Attempt ${nextAttempt} failed: ${params.error_message}. Retry scheduled for ${retryAtIso}`;
            post.updated_at = nowIso;

            if (job) {
              job.status = 'scheduled';
              job.scheduled_at = retryAtIso;
              job.attempts = nextAttempt;
              job.claim_token = null;
              job.lease_expires_at = null;
              job.last_error = params.error_message;
              job.updated_at = nowIso;
            }

            return {
              data: {
                success: true,
                action: 'scheduled_retry',
                attempts: nextAttempt,
                retry_at: retryAtIso,
              },
              error: null,
            };
          } else {
            post.status = 'failed';
            post.claim_token = null;
            post.lease_expires_at = null;
            post.error_message = `Exhausted max retries (${maxAttempts}): ${params.error_message}`;
            post.updated_at = nowIso;

            if (job) {
              job.status = 'failed';
              job.attempts = nextAttempt;
              job.claim_token = null;
              job.lease_expires_at = null;
              job.last_error = `Exhausted max retries (${maxAttempts}): ${params.error_message}`;
              job.updated_at = nowIso;
            }

            return {
              data: {
                success: true,
                action: 'marked_failed_terminal',
                attempts: nextAttempt,
              },
              error: null,
            };
          }
        }

        return { data: null, error: { message: `Unknown function ${fnName}` } };
      },
      from: (table: string) => {
        let filters: Array<{ col: string; val: any; op?: string }> = [];
        let sortCol: string | null = null;
        let sortAscending = true;

        const getProcessedRows = () => {
          let rows = [...(testStore[table] || [])];
          if (sortCol) {
            rows.sort((a, b) => {
              if (a[sortCol!] < b[sortCol!]) return sortAscending ? -1 : 1;
              if (a[sortCol!] > b[sortCol!]) return sortAscending ? 1 : -1;
              return 0;
            });
          }
          return rows.filter((r) =>
            filters.every((f) => {
              if (f.op === 'lte') return r[f.col] <= f.val;
              if (f.op === 'lt') return r[f.col] < f.val;
              if (f.op === 'gte') return r[f.col] >= f.val;
              if (f.op === 'gt') return r[f.col] > f.val;
              if (f.op === 'in') return Array.isArray(f.val) && f.val.includes(r[f.col]);
              return r[f.col] === f.val;
            })
          );
        };

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
            order: (col: string, opts?: { ascending?: boolean }) => {
              sortCol = col;
              sortAscending = opts?.ascending ?? true;
              return builder;
            },
            maybeSingle: async () => {
              if (process.env.SIMULATE_DB_ERROR === 'true') {
                return { data: null, error: { message: 'connection failure: database unreachable', code: '08006' } };
              }
              const rows = getProcessedRows();
              return { data: rows[0] || null, error: null };
            },
            single: async () => {
              if (process.env.SIMULATE_DB_ERROR === 'true') {
                return { data: null, error: { message: 'connection failure: database unreachable', code: '08006' } };
              }
              const rows = getProcessedRows();
              return { data: rows[0] || null, error: rows[0] ? null : new Error('Not found') };
            },
            then: (resolve: any, reject: any) => {
              if (process.env.SIMULATE_DB_ERROR === 'true') {
                return Promise.resolve({
                  data: null,
                  count: null,
                  error: { message: 'connection failure: database unreachable', code: '08006' },
                }).then(resolve, reject);
              }
              const filtered = getProcessedRows();
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
            const enrichedRecord = {
              ...record,
              id: record.id || `mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              created_at: record.created_at || new Date().toISOString(),
              ...(table === 'scheduler_execution_logs' && !record.invoked_at ? { invoked_at: new Date().toISOString() } : {}),
            };
            rows.push(enrichedRecord);
            return {
              data: enrichedRecord,
              error: null,
              select: () => ({
                maybeSingle: async () => ({ data: enrichedRecord, error: null }),
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
              select: () => {
                const matches = executeUpdate();
                return {
                  ...updateBuilder,
                  then: (resolve: any, reject: any) => {
                    return Promise.resolve({ data: matches, error: null }).then(resolve, reject);
                  },
                  maybeSingle: async () => {
                    return { data: matches[0] || null, error: null };
                  },
                  single: async () => {
                    return { data: matches[0] || null, error: matches[0] ? null : new Error('Not found') };
                  },
                };
              },
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
