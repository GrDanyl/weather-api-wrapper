import { z } from 'zod';

const environmentSchema = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  VISUAL_CROSSING_API_KEY: z.string().min(1, 'VISUAL_CROSSING_API_KEY is required'),
  WEATHER_UNIT_SYSTEM: z.enum(['metric', 'us', 'uk']).default('metric'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(43_200),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(60),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return parsed.data;
}
