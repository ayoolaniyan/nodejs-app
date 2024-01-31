import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from 'src/prisma.service';
import { CustomerResolver } from './customer.resolver';
import { CustomerController } from './customer.controller';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';

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
  controllers: [CustomerController],
  providers: [CustomerService, PrismaService, CustomerResolver],
})
export class CustomerModule {}
