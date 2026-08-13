import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { RedisCache } from './infrastructure/redis-cache.js';
import { VisualCrossingProvider } from './infrastructure/visual-crossing-provider.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const cache = new RedisCache(config.REDIS_URL);
  const weatherProvider = new VisualCrossingProvider(config.VISUAL_CROSSING_API_KEY, config.WEATHER_UNIT_SYSTEM);
  const app = await buildApp(config, { cache, weatherProvider });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exit(1);
  }
}

void start();
