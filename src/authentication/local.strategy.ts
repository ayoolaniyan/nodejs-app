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

  async validate(email: string, password: string): Promise<any> {
    console.log('vali', email);
    console.log('valie', password);
    const payload: Prisma.CustomerWhereUniqueInput = { email, password };
    const customer = await this.authService.validateCustomer(payload);
    console.log('vali', customer);
    if (!customer) {
      throw new UnauthorizedException();
    }
    return customer;
  }
}
