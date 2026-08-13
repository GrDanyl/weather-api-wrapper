import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import type { Cache } from '../src/domain/cache.js';
import { LocationNotFoundError, type WeatherProvider, type WeatherSnapshot, UpstreamServiceError } from '../src/domain/weather.js';

const config: AppConfig = {
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  VISUAL_CROSSING_API_KEY: 'test-key',
  WEATHER_UNIT_SYSTEM: 'metric',
  REDIS_URL: 'redis://localhost:6379',
  CACHE_TTL_SECONDS: 3600,
  RATE_LIMIT_MAX: 10,
  RATE_LIMIT_WINDOW: '1 minute',
};

const weather: WeatherSnapshot = {
  location: { name: 'Berlin, Germany', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' },
  current: {
    observedAt: '2026-08-13T09:00:00.000Z',
    temperature: 20,
    feelsLike: 20,
    humidity: 55,
    conditions: 'Partially cloudy',
    windSpeed: 13,
    visibility: 10,
    uvIndex: 4,
  },
  units: 'metric',
};

describe('GET /v1/weather/:location', () => {
  let cache: Cache;
  let provider: WeatherProvider;

  beforeEach(() => {
    cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn(), disconnect: vi.fn() };
    provider = { getCurrentWeather: vi.fn().mockResolvedValue(weather) };
  });

  it('returns upstream weather and caches a miss', async () => {
    const app = await buildApp(config, { cache, weatherProvider: provider }, false);
    const response = await app.inject({ method: 'GET', url: '/v1/weather/Berlin' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-cache']).toBe('MISS');
    expect(response.json()).toMatchObject({ data: weather, meta: { cache: 'MISS' } });
    expect(provider.getCurrentWeather).toHaveBeenCalledWith('Berlin');
    expect(cache.set).toHaveBeenCalledWith('weather:v1:berlin', weather, 3600);
    await app.close();
  });

  it('serves a cached response without calling the provider', async () => {
    cache.get = vi.fn().mockResolvedValue(weather);
    const app = await buildApp(config, { cache, weatherProvider: provider }, false);
    const response = await app.inject({ method: 'GET', url: '/v1/weather/Berlin' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-cache']).toBe('HIT');
    expect(provider.getCurrentWeather).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns a 404 for an unknown location', async () => {
    provider.getCurrentWeather = vi.fn().mockRejectedValue(new LocationNotFoundError('Atlantis'));
    const app = await buildApp(config, { cache, weatherProvider: provider }, false);
    const response = await app.inject({ method: 'GET', url: '/v1/weather/Atlantis' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('LOCATION_NOT_FOUND');
    await app.close();
  });

  it('returns a 502 when the upstream provider fails', async () => {
    provider.getCurrentWeather = vi.fn().mockRejectedValue(new UpstreamServiceError());
    const app = await buildApp(config, { cache, weatherProvider: provider }, false);
    const response = await app.inject({ method: 'GET', url: '/v1/weather/Berlin' });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('WEATHER_PROVIDER_UNAVAILABLE');
    await app.close();
  });
});
