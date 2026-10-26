import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Request } from 'express';

import { PrismaModule } from './prisma.module';
import { CustomerModule } from './customer/customer.module';
import { AuthModule } from './authentication/auth.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';
import { AppThrottlerGuard } from './throttler.guard';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    // First, so that every other module's factory can read configuration.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // A ceiling for every route, per client IP. The auth endpoints set a
    // much lower limit of their own.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Written to disk during development so schema changes show up in
      // review. In production the schema is built in memory: the app must
      // not write into its own install directory, which a hardened
      // container mounts read-only.
      autoSchemaFile: isProduction
        ? true
        : join(process.cwd(), 'src/schema.gql'),
      buildSchemaOptions: { dateScalarMode: 'timestamp' },
      // Schema introspection and the in-browser IDE expose the full API
      // surface, so they are limited to non-production environments.
      // GraphiQL replaces the deprecated GraphQL Playground.
      playground: false,
      graphiql: !isProduction,
      introspection: !isProduction,
      // Exposes the HTTP request to resolvers, which is where JwtAuthGuard
      // finds the bearer token.
      context: ({ req }: { req: Request }) => ({ req }),
    }),
    PrismaModule,
    CustomerModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
