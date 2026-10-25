import { Module } from '@nestjs/common';
import { join } from 'path';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { CustomerModule } from './customer/customer.module';
import { AuthModule } from './authentication/auth.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    // First, so that every other module's factory can read configuration.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      buildSchemaOptions: { dateScalarMode: 'timestamp' },
      // Schema introspection and the playground expose the full API surface,
      // so they are limited to non-production environments.
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      // Exposes the HTTP request to resolvers, which is where JwtAuthGuard
      // finds the bearer token.
      context: ({ req }) => ({ req }),
    }),
    PrismaModule,
    CustomerModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
