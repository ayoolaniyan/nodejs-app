import { Prisma } from '@prisma/client';

/**
 * Seed customers. Passwords are plain text here and are hashed by seed.ts
 * before they reach the database — the previous version stored them
 * verbatim, which meant argon2.verify() could never match at login.
 */
export const customers: (Omit<
  Prisma.CustomerUpsertArgs['create'],
  'password'
> & {
  password: string;
})[] = [
  {
    id: '9e391faf-64b2-4d4c-b879-463532920fd3',
    email: 'user@example.com',
    password: 'local-dev-password',
    role: 'USER',
  },
  {
    id: '9e391faf-64b2-4d4c-b879-463532920fd4',
    email: 'admin@example.com',
    password: 'local-dev-password',
    role: 'ADMIN',
  },
];
