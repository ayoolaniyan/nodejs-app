/**
 * Mirrors the `Role` enum in prisma/schema.prisma. The values must stay
 * identical to the database values — comparing 'user' against a stored
 * 'USER' silently denies every request.
 */
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}
