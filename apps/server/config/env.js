import 'dotenv/config';
import { z } from 'zod';

const requiredValue = (name, minimum = 1) => z.string()
  .min(minimum, `${name} is required`)
  .refine(
    (value) => !/(replace_with|your_|change_me|example)/i.test(value),
    `${name} must be replaced with a real value`
  );

const positiveInteger = (fallback) => z.coerce.number().int().positive().default(fallback);
const optionalUrl = z.string().url().optional();

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInteger(5001),
  MONGO_URI: z.string()
    .regex(/^mongodb(?:\+srv)?:\/\//, 'must be a MongoDB connection string')
    .default('mongodb://127.0.0.1:27017/printlabs'),
  JWT_SECRET: requiredValue('JWT_SECRET', 32),
  CLOUDINARY_CLOUD_NAME: requiredValue('CLOUDINARY_CLOUD_NAME'),
  CLOUDINARY_API_KEY: requiredValue('CLOUDINARY_API_KEY'),
  CLOUDINARY_API_SECRET: requiredValue('CLOUDINARY_API_SECRET'),
  RAZORPAY_KEY_ID: requiredValue('RAZORPAY_KEY_ID'),
  RAZORPAY_KEY_SECRET: requiredValue('RAZORPAY_KEY_SECRET'),
  INTERNAL_API_KEY: requiredValue('INTERNAL_API_KEY', 32),
  AI_SERVICE_URL: z.string().url().default('http://127.0.0.1:8100'),
  AI_TIMEOUT_MS: positiveInteger(15000),
  AI_REINDEX_DEBOUNCE_MS: positiveInteger(2000),
  AI_REINDEX_MAX_DELAY_MS: positiveInteger(15000),
  AI_REINDEX_TIMEOUT_MS: positiveInteger(60000),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  CLIENT_URL: optionalUrl,
  ADMIN_URL: optionalUrl,
  TRUST_PROXY: z.preprocess(
    (value) => value === '' || value === undefined ? undefined : Number(value),
    z.number().int().positive().optional()
  ),
  AUDIT_LOG_DIR: z.string().optional(),
  AUDIT_MAX_FILE_BYTES: positiveInteger(5 * 1024 * 1024),
  AUDIT_MAX_FILES: positiveInteger(30),
  AUDIT_FLUSH_MS: positiveInteger(500),
  TEST_PUBLIC_ID: z.string().optional(),
});

const result = environmentSchema.safeParse(process.env);
if (!result.success) {
  const messages = result.error.issues.map((issue) => {
    const name = issue.path[0] || 'environment';
    return `  - ${name}: ${issue.message}`;
  });
  console.error(
    'Invalid server environment:\n' + messages.join('\n') +
    '\nCopy apps/server/.env.example to apps/server/.env and set the listed values.'
  );
  process.exit(1);
}

export const env = result.data;
export default env;
