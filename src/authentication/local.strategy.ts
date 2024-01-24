import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super();
  }

  async validate(customerInfo: Prisma.CustomerWhereUniqueInput) {
    const customer = await this.authService.validateUser(customerInfo);
    console.log('customer info: ', customer);
    if (!customer) {
      throw new UnauthorizedException();
    }
    return customer;
  }
}
