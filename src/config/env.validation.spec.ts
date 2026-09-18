import { validateEnv } from './env.validation';

const valid = {
  DATABASE_URL: 'postgresql://localhost:5432/app',
  JWT_SECRET: 'access',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('validateEnv', () => {
  it('passes a complete configuration through unchanged', () => {
    expect(validateEnv({ ...valid })).toMatchObject(valid);
  });

  it('names every missing variable at once', () => {
    const { JWT_SECRET: _s, DATABASE_URL: _d, ...incomplete } = valid;
    expect(() => validateEnv(incomplete)).toThrow(/DATABASE_URL/);
    expect(() => validateEnv(incomplete)).toThrow(/JWT_SECRET/);
  });

  it('rejects reusing one secret for both token types', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_SECRET }),
    ).toThrow(/must differ/);
  });
});
