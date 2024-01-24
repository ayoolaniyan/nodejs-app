import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { CustomerService } from 'src/customer/customer.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly customerService: CustomerService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
      ignoreExpiration: false,
    });
  }

  async validate(addCustomer: Prisma.CustomerWhereUniqueInput) {
    const customer = await this.customerService.findCustomerById(addCustomer);
    return customer;
  }
}
