import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { AppConfig } from './config.js';
import { weatherCacheKey, type Cache } from './domain/cache.js';
import { LocationNotFoundError, type WeatherProvider, UpstreamServiceError } from './domain/weather.js';

const locationParamsSchema = z.object({
  location: z.string().trim().min(1, 'Location must not be empty.').max(120, 'Location is too long.'),
});

export interface AppDependencies {
  cache: Cache;
  weatherProvider: WeatherProvider;
}

export async function buildApp(
  config: AppConfig,
  dependencies: AppDependencies,
  logger: FastifyBaseLogger | boolean = true,
): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    }),
  });

  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));

  app.get('/v1/weather/:location', async (request, reply) => {
    const parsedParams = locationParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_LOCATION',
          message: parsedParams.error.issues[0]?.message ?? 'Invalid location.',
        },
      });
    }

    const { location } = parsedParams.data;
    const cacheKey = weatherCacheKey(location);
    const cached = await safelyReadCache(dependencies.cache, cacheKey, request);

    if (cached) {
      reply.header('X-Cache', 'HIT');
      return { data: cached, meta: { cache: 'HIT' } };
    }

    const weather = await dependencies.weatherProvider.getCurrentWeather(location);
    await safelyWriteCache(dependencies.cache, cacheKey, weather, config.CACHE_TTL_SECONDS, request);
    reply.header('X-Cache', 'MISS');
    return { data: weather, meta: { cache: 'MISS' } };
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof LocationNotFoundError) {
      return reply.code(404).send({ error: { code: 'LOCATION_NOT_FOUND', message: error.message } });
    }

    if (error instanceof UpstreamServiceError) {
      return reply.code(502).send({ error: { code: 'WEATHER_PROVIDER_UNAVAILABLE', message: error.message } });
    }

    request.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } });
  });

  app.addHook('onClose', async () => {
    await dependencies.cache.disconnect();
  });

  return app;
}

async function safelyReadCache<T>(cache: Cache, key: string, request: { log: FastifyBaseLogger }): Promise<T | null> {
  try {
    return await cache.get<T>(key);
  } catch (error) {
    request.log.warn({ err: error }, 'Cache read failed; continuing without cache');
    return null;
  }
}

async function safelyWriteCache<T>(
  cache: Cache,
  key: string,
  value: T,
  ttlSeconds: number,
  request: { log: FastifyBaseLogger },
): Promise<void> {
  try {
    await cache.set(key, value, ttlSeconds);
  } catch (error) {
    request.log.warn({ err: error }, 'Cache write failed; continuing without cache');
  }
}
