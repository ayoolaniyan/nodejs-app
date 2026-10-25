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

const durations = ['JWT_EXPIRES_IN', 'JWT_REFRESH_EXPIRES_IN'] as const;

export function validateEnv(config: Record<string, unknown>) {
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'See .env.example.',
    );
  }

  // jsonwebtoken reads a bare number as seconds and a string as a duration
  // ('15m', '7d'). A typo such as '15 mins' is otherwise only reported when
  // the first token is signed.
  const badDurations = durations.filter(
    (key) => !/^\d+(ms|s|m|h|d|w|y)?$/.test(String(config[key])),
  );
  if (badDurations.length > 0) {
    throw new Error(
      `Invalid duration in ${badDurations.join(', ')}: use a number of ` +
        "seconds or a value such as '15m' or '7d'.",
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
