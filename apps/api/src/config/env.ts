import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required')
    .default('postgresql://postgres:postgres@localhost:5432/auravet'),
  CORS_ORIGIN: z.string().optional(),
  JWT_SECRET: z
    .string()
    .min(1, 'JWT_SECRET is required')
    .default('development-jwt-secret'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  PASSWORD_SALT_ROUNDS: z.coerce.number().min(4).default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().min(1).default(10),
  SERVICE_NOTES_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

const usedDefaultDatabaseUrl = !process.env.DATABASE_URL;
const usedDefaultJwtSecret = !process.env.JWT_SECRET;

if (env.NODE_ENV === 'production' && (usedDefaultDatabaseUrl || usedDefaultJwtSecret)) {
  console.error('❌ Missing DATABASE_URL/JWT_SECRET environment variables in production.');
  process.exit(1);
}

if (usedDefaultDatabaseUrl || usedDefaultJwtSecret) {
  const missing = [
    usedDefaultDatabaseUrl ? 'DATABASE_URL' : undefined,
    usedDefaultJwtSecret ? 'JWT_SECRET' : undefined,
  ]
    .filter(Boolean)
    .join(' and ');

  console.warn(
    `⚠️  Using default value for ${missing}. Provide explicit environment variables to override in your environment.`,
  );
}

export { env };
