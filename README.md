# nodejs-app

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
| Framework | NestJS 9 |
| Language | TypeScript |
| Database | PostgreSQL via Prisma |
| API | REST (Swagger at `/api`) and GraphQL (Apollo) |
| Auth | Passport JWT, argon2 password hashing |
| Tests | Jest (unit) and Supertest (HTTP) |

## Running it

```bash
cp .env.example .env          # then fill in the two JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # requires a reachable PostgreSQL
npm run prisma:seed           # optional: two local accounts
npm run start:dev
```

Swagger UI is served at `http://localhost:8080/api` and the GraphQL
playground at `http://localhost:8080/graphql`, both disabled when
`NODE_ENV=production`.

## Tests

```bash
npm test        # unit tests
npm run test:e2e   # HTTP-level tests, no database required
npm run lint
npm run typecheck
```

The e2e suite substitutes an in-memory double for the persistence layer, so
it runs in CI without a PostgreSQL service container. Both suites run on
every push via GitHub Actions.

## Authentication model

| Endpoint | Access |
| --- | --- |
| `POST /auth/signup` | public |
| `POST /auth/login` | public |
| `POST /auth/refresh` | a valid refresh token |
| `POST /auth/logout`, `GET /auth/me` | any authenticated customer |
| `GET /customers/:id`, `PATCH /customers/:id` | that customer, or `ADMIN` |
| `GET /customers`, GraphQL `customers`, `DELETE /customers/:id` | `ADMIN` only |

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
src/lib/         shared entities and date helpers
test/            HTTP-level tests and Jest setup
```

## Licence

MIT
