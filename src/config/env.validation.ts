/**
 * Fails fast at boot if required configuration is missing.
 *
 * Without this, a missing JWT_SECRET surfaces much later as tokens signed
 * with `undefined` — which still produces a working-looking token.
 */
const required = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRES_IN',
] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'See .env.example.',
    );
  }

  if (String(config.JWT_SECRET) === String(config.JWT_REFRESH_SECRET)) {
    throw new Error(
      'JWT_SECRET and JWT_REFRESH_SECRET must differ, otherwise a refresh ' +
        'token is accepted anywhere an access token is.',
    );
  }

  return config;
}
