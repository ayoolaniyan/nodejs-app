# nestjs-customer-api

[![CI](https://github.com/ayoolaniyan/nestjs-customer-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ayoolaniyan/nestjs-customer-api/actions/workflows/ci.yml)

A NestJS service exposing customer records over both REST and GraphQL, with
JWT authentication, role-based authorisation and Prisma/PostgreSQL
persistence.

It began as a take-home exercise and is kept here as a working reference for
how I structure a Nest service: thin controllers, business rules in services,
persistence behind Prisma, and authorisation decided by guards rather than by
the code inside each handler.

## Stack

| Concern | Choice |
| --- | --- |
| Runtime | Node.js 20 or later |
| Framework | NestJS 11 |
| Language | TypeScript 5, `strict` mode |
| Database | PostgreSQL via Prisma |
| API | REST (Swagger at `/api`) and GraphQL (Apollo Server 5) |
| Auth | Passport JWT, argon2 password hashing |
| Hardening | helmet, per-IP rate limiting, CORS allow-list |
| Tests | Jest (unit) and Supertest (HTTP) |

## Running it

Create `.env` and fill in three generated values: `POSTGRES_PASSWORD`, and
two different JWT secrets. No credential is committed to the repository;
the database URLs in `.env` refer to `POSTGRES_PASSWORD`, so it is set once.

```bash
cp .env.example .env
# one value per variable:
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Compose refuses to start without `POSTGRES_PASSWORD`. The API refuses to
start without the JWT secrets, naming whichever is missing.

**Everything in Docker.** PostgreSQL, the migrations and the production
image of the API:

```bash
docker compose up --build     # API on http://localhost:8080
```

**API on the host, database in Docker**, with hot reload:

```bash
docker compose up -d db
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed           # optional: two local accounts
npm run start:dev
```

Swagger UI is served at `http://localhost:8080/api` and GraphiQL at
`http://localhost:8080/graphql`, both disabled when `NODE_ENV=production`.

`GET /health` returns 200 when the database answers and 503 when it does
not, for use as a load balancer or container health probe.

Cross-origin browser requests are refused unless the origin is listed in
`CORS_ORIGINS` (comma-separated).

## Tests

```bash
npm test            # unit tests
npm run test:e2e    # HTTP-level tests, no database required
npm run test:cov    # both, with coverage thresholds
npm run lint
npm run typecheck

# against a running stack (docker compose up), with a real PostgreSQL
node scripts/smoke-test.mjs
```

The unit and e2e suites substitute an in-memory double for the database,
so they run in seconds and need no services. Together they cover about 98%
of statements; CI fails below the thresholds in `test/jest-coverage.json`.

What a double cannot prove is checked by a second CI job, which builds the
production Docker image, applies every migration to an empty PostgreSQL,
and runs `scripts/smoke-test.mjs` against it, including concurrent
duplicate signups that only the database's unique index can catch. The
same job fails if `schema.prisma` has changed without a matching
migration. Both jobs run on every push and pull request.

## Authentication model

| Endpoint | Access |
| --- | --- |
| `POST /auth/signup` | public, 10 requests per minute per IP |
| `POST /auth/login` | public, 10 requests per minute per IP |
| `POST /auth/refresh` | a valid refresh token, 10 requests per minute per IP |
| `GET /health` | public |
| `POST /auth/logout`, `GET /auth/me` | any authenticated customer |
| `GET /customers/:id`, `PATCH /customers/:id` | that customer, or `ADMIN` |
| `GET /customers`, GraphQL `customers`, `DELETE /customers/:id` | `ADMIN` only |

Every other route is limited to 100 requests per minute per IP. Limits are
keyed on the connecting address, so behind a reverse proxy Express's
`trust proxy` setting must be enabled for them to apply per client.

Access and refresh tokens are signed with **different** secrets, and the
application refuses to start if they are equal, otherwise a refresh token
would be accepted anywhere an access token is. Token claims carry the
customer id, email and role; a JWT payload is base64, not encryption, so
nothing secret goes in it.

Refresh tokens are rotated: `/auth/refresh` accepts only the most recently
issued one (its argon2 hash is stored on the customer) and replaces it, and
`/auth/logout` clears it. Access tokens are not revocable and remain valid
until they expire, so `JWT_EXPIRES_IN` should stay short.

## Notable design decisions

**Authorisation reads from the token, not the request.** `RolesGuard`
resolves the caller's role from `request.user`, populated by the JWT
strategy from a signed token. An earlier version read it from the request
body, which let any caller grant themselves a role by sending one; there is
a regression test for exactly that case in `roles.guard.spec.ts`.

**Login does not reveal which accounts exist.** An unknown email and a
wrong password get the same 401, and both cost one argon2 verification (an
unknown email is checked against a dummy hash), so neither the response nor
its timing tells them apart. Signup is different: it must return 409 for an
email that is already registered, so it does reveal that the address has an
account. Closing that would need an email-verification signup flow, which
this service does not implement.

**The JWT strategy re-reads the customer on each request.** Slightly more
work per call, but a token minted before a role change or an account
deletion stops working immediately.

**Configuration is validated at boot.** `validateEnv` fails fast on missing
variables. Without it, an absent `JWT_SECRET` produces tokens signed with
`undefined`, which look perfectly valid until something tries to verify
them.

**Selects are explicit.** Read paths use a `publicCustomerFields` select so
neither the password hash nor the refresh token hash can reach a response
by accident. The two methods that return the full record
(`findCustomerEmail` and `findAuthRecordById`) are documented as being for
the auth layer only.

## Repository layout

```
prisma/          schema, migrations and seed data
src/authentication/  controller, service, JWT strategies, role guard
src/customer/    REST controller, GraphQL resolver, service, DTOs
src/config/      environment validation
src/health/      database health check
src/lib/         shared entities and date helpers
test/            HTTP-level tests and Jest setup
scripts/         smoke test for a running instance
```

## Known limitations and next steps

- **Signup reveals registered emails.** It has to return 409 for an
  existing address. Fixing that properly means an email-verification flow
  that answers every signup the same way.
- **Access tokens cannot be revoked.** Logout revokes the refresh token,
  but an access token stays valid until it expires. Keep `JWT_EXPIRES_IN`
  short, or add a token denylist if immediate revocation matters.
- **One refresh token per customer.** Logging in on a second device
  replaces the first device's refresh token. Per-device sessions would need
  a sessions table.
- **Rate limits are per process and in memory.** With several instances,
  or after a restart, the counts are not shared. A Redis-backed throttler
  storage fixes both.
- **No password reset or email change verification.** Changing the email
  on an account takes effect immediately, without confirming the new
  address.
- **Customer lists use offset pagination**, which slows down on large
  tables. Cursor pagination on `createdAt` and `id` would scale better.

## Licence

MIT
