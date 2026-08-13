# Weather API Wrapper Service

A small REST service that retrieves current weather from [Visual Crossing Weather](https://www.visualcrossing.com/weather-api), normalizes the response, caches it in Redis, and protects the endpoint with rate limiting.

This project was built from the [roadmap.sh Weather API project](https://roadmap.sh/projects/weather-api-wrapper-service). It demonstrates third-party API integration, environment-based configuration, caching, error handling, and abuse protection.

## Features

- `GET /v1/weather/:location` for current weather by city, postal code, or latitude/longitude.
- Redis cache with a configurable TTL (12 hours by default).
- Cache outages do not make the weather endpoint unavailable.
- Clear JSON error responses for unknown locations and provider failures.
- IP-based rate limiting (60 requests per minute by default).
- TypeScript, Fastify, Zod validation, ESLint, and automated tests.
- Docker Compose configuration for local Redis.

## Quick start

### Prerequisites

- Node.js 20 or later
- A Redis instance (or Docker)
- A free [Visual Crossing Weather API key](https://www.visualcrossing.com/weather-api)

### Run locally

```bash
git clone https://github.com/<your-username>/weather-api-wrapper.git
cd weather-api-wrapper
npm install
copy .env.example .env
docker compose up -d redis
```

Set `VISUAL_CROSSING_API_KEY` in `.env`, then start the API:

```bash
npm run dev
```

The server listens at `http://localhost:3000` by default.

> On macOS/Linux, replace `copy .env.example .env` with `cp .env.example .env`.

## API

### Get current weather

```http
GET /v1/weather/{location}
```

`location` is URL encoded. Examples: `Berlin`, `New%20York`, `90210`, or `52.52,13.405`.

```bash
curl http://localhost:3000/v1/weather/Berlin
```

Successful response:

```json
{
  "data": {
    "location": {
      "name": "Berlin, Germany",
      "latitude": 52.52,
      "longitude": 13.405,
      "timezone": "Europe/Berlin"
    },
    "current": {
      "observedAt": "2026-08-13T09:00:00.000Z",
      "temperature": 20,
      "feelsLike": 20,
      "humidity": 55,
      "conditions": "Partially cloudy",
      "windSpeed": 13,
      "visibility": 10,
      "uvIndex": 4
    },
    "units": "metric"
  },
  "meta": { "cache": "MISS" }
}
```

The `X-Cache` header and `meta.cache` are `MISS` on the first successful request and `HIT` when Redis supplies a cached response.

### Health check

```http
GET /health
```

Returns `{"status":"ok"}`. This endpoint is intentionally excluded from rate limiting.

### Error responses

| Status | Error code | Meaning |
| --- | --- | --- |
| `400` | `INVALID_LOCATION` | Location is blank or exceeds 120 characters. |
| `404` | `LOCATION_NOT_FOUND` | The provider does not recognize the location. |
| `429` | `RATE_LIMITED` | The client exceeded the configured request limit. |
| `502` | `WEATHER_PROVIDER_UNAVAILABLE` | Visual Crossing could not be reached or returned an invalid response. |
| `500` | `INTERNAL_ERROR` | An unexpected server error occurred. |

## Configuration

Copy `.env.example` to `.env` and set the API key. Do not commit `.env`.

| Variable | Default | Description |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Address on which the API listens. |
| `PORT` | `3000` | Server port. |
| `LOG_LEVEL` | `info` | Fastify/Pino log level. |
| `VISUAL_CROSSING_API_KEY` | — | Required API key for the weather provider. |
| `WEATHER_UNIT_SYSTEM` | `metric` | `metric`, `us`, or `uk`. |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL. |
| `CACHE_TTL_SECONDS` | `43200` | Cache lifetime in seconds. |
| `RATE_LIMIT_MAX` | `60` | Maximum requests in the time window per IP. |
| `RATE_LIMIT_WINDOW` | `1 minute` | Rate-limit window understood by Fastify. |

## Development

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Deployment notes

The `Dockerfile` produces a minimal production image. Provide configuration as environment variables and point `REDIS_URL` at a managed Redis instance in production. The API does not fall back to an in-process cache: this keeps cache behavior consistent across multiple instances. If Redis is temporarily unreachable, requests are still served from the upstream provider and the incident is logged.

## Project structure

```text
src/
  domain/           Interfaces, models, and domain errors
  infrastructure/   Redis and Visual Crossing integrations
  app.ts            HTTP routes, caching flow, and error mapping
  server.ts         Application composition and graceful shutdown
tests/              API tests using Fastify injection
```

## License

Distributed under the [MIT License](LICENSE).
