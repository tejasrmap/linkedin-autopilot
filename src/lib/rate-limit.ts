// ==============================================================
// LINKEDIN AUTOPILOT - API RATE LIMITER (SLIDING WINDOW)
// BY GT INNOX LLP
// ==============================================================

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((record, key) => {
    record.timestamps = record.timestamps.filter((t) => now - t < 60000);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  });
}, 300000);

if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

export interface RateLimitOptions {
  limit?: number; // max requests
  windowMs?: number; // window size in milliseconds
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetMs: number } {
  const limit = options.limit || 60; // 60 requests
  const windowMs = options.windowMs || 60000; // per 1 minute
  const now = Date.now();

  let record = rateLimitStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Filter out timestamps outside window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldestTimestamp));
    return {
      allowed: false,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: limit - record.timestamps.length,
    resetMs: windowMs,
  };
}
