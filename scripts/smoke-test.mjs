#!/usr/bin/env node
/**
 * End-to-end smoke test against a running instance backed by a real
 * PostgreSQL — the parts the in-memory e2e suite cannot reach: migrations,
 * unique constraints and the production build.
 *
 *   docker compose up --build -d
 *   node scripts/smoke-test.mjs [base-url]     # default http://localhost:8080
 *
 * Exits non-zero on the first failed check. Uses only Node built-ins.
 */
import { randomUUID } from 'node:crypto';

const base = process.argv[2] ?? 'http://localhost:8080';
const email = `smoke-${randomUUID()}@example.com`;
const password = 'smoke-test-password';

let failures = 0;

function check(name, condition, detail = '') {
  console.log(
    `${condition ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`,
  );
  if (!condition) failures++;
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, headers: response.headers };
}

async function waitForHealthy(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${base}/health`)).ok) return true;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

if (!(await waitForHealthy())) {
  console.error(`No healthy instance at ${base}/health`);
  process.exit(1);
}

const health = await call('GET', '/health');
check(
  'health reports the database up',
  health.json?.info?.database?.status === 'up',
);
check(
  'helmet sets security headers',
  health.headers.get('x-content-type-options') === 'nosniff',
);

const signup = await call('POST', '/auth/signup', {
  body: { email, password },
});
check(
  'signup returns 201 and tokens',
  signup.status === 201 && !!signup.json?.access_token,
  `status ${signup.status}`,
);
const { access_token: accessToken, refresh_token: refreshToken } =
  signup.json ?? {};

const me = await call('GET', '/auth/me', { token: accessToken });
check('the access token identifies the new customer', me.json?.email === email);
check(
  'no hash is returned',
  me.json && !('password' in me.json) && !('refreshTokenHash' in me.json),
);

// Several at once, so that some pass the existence check before any insert
// lands; the database's unique index has to turn those into 409s, not 500s.
const raceEmail = `race-${randomUUID()}@example.com`;
const race = await Promise.all(
  Array.from({ length: 5 }, () =>
    call('POST', '/auth/signup', { body: { email: raceEmail, password } }),
  ),
);
const statuses = race.map((r) => r.status).sort();
check(
  'concurrent duplicate signups: one 201, the rest 409',
  statuses.filter((s) => s === 201).length === 1 &&
    statuses.filter((s) => s === 409).length === 4,
  statuses.join(','),
);

const login = await call('POST', '/auth/login', { body: { email, password } });
check(
  'login with the new password',
  login.status === 200,
  `status ${login.status}`,
);
const wrong = await call('POST', '/auth/login', {
  body: { email, password: 'not-the-password' },
});
check('wrong password is 401', wrong.status === 401);

const own = await call('GET', `/customers/${me.json?.id}`, {
  token: accessToken,
});
check('a customer can read their own record', own.status === 200);
const list = await call('GET', '/customers', { token: accessToken });
check('a customer cannot list all customers', list.status === 403);

const gql = await call('POST', '/graphql', {
  token: accessToken,
  body: { query: '{ customers { id } }' },
});
check(
  'GraphQL authenticates and enforces roles',
  /forbidden/i.test(gql.json?.errors?.[0]?.message ?? ''),
);

// login above rotated the refresh token, so the one from signup is spent.
const stale = await call('POST', '/auth/refresh', { token: refreshToken });
check('a superseded refresh token is rejected', stale.status === 401);
const refreshed = await call('POST', '/auth/refresh', {
  token: login.json?.refresh_token,
});
check('the current refresh token is exchanged', refreshed.status === 200);
const replay = await call('POST', '/auth/refresh', {
  token: login.json?.refresh_token,
});
check('a refresh token works only once', replay.status === 401);

const logout = await call('POST', '/auth/logout', {
  token: refreshed.json?.access_token,
});
check('logout', logout.status === 204);
const afterLogout = await call('POST', '/auth/refresh', {
  token: refreshed.json?.refresh_token,
});
check('logout revokes the refresh token', afterLogout.status === 401);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
