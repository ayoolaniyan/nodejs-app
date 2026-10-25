import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenStrategy } from './access-token.strategy';
import { RefreshTokenStrategy } from './refresh-token.strategy';
import { RolesGuard } from './role/roles.guard';
import { CustomerModule } from 'src/customer/customer.module';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    // No defaults: AuthService passes the secret and expiry for each token
    // type explicitly, and the passport strategies verify with their own.
    JwtModule.register({}),
    CustomerModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    RolesGuard,
  ],
})
export class AuthModule {}
