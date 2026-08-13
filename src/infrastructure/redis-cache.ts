import { Redis } from 'ioredis';

import type { Cache } from '../domain/cache.js';

export class RedisCache implements Cache {
  private readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection();
    const serialized = await this.client.get(key);
    return serialized === null ? null : (JSON.parse(serialized) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.ensureConnection();
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async disconnect(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit();
    }
  }

  private async ensureConnection(): Promise<void> {
    if (this.client.status === 'wait') {
      await this.client.connect();
    }
  }
}
