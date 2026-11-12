// ==============================================================
// LINKEDIN AUTOPILOT - REDIS & BULLMQ CONFIGURATION
// BY GT INNOX LLP
// ==============================================================

import { Redis, RedisOptions } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export function getRedisConnection(): Redis {
  const options: RedisOptions = {
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 2) return null; // Stop retrying quickly if Redis is offline
      return 500;
    },
  };

  const redis = new Redis(redisUrl, options);
  redis.on('error', (err) => {
    // Suppress unhandled redis connection error in dev
  });
  return redis;
}

