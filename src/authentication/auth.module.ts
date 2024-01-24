import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma.service';
import { AccessTokenStrategy } from './access-token.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { CustomerService } from 'src/customer/customer.service';
import { LocalStrategy } from './local.strategy';
import { RolesGuard } from './role/roles.guard';
import { RefreshTokenStrategy } from './refresh-token.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'process.env.JWT_SECRET',
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN,
      },
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    CustomerService,
    PrismaService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
    RolesGuard,
  ],
})
export class AuthModule {}
