import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerService } from 'src/customer/customer.service';
import { JwtService } from '@nestjs/jwt';
import { WhereCustomerInput } from 'src/customer/dto/customer.input';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly customerService: CustomerService,
  ) {}

  async validateUser(addCustomer: Prisma.CustomerWhereUniqueInput) {
    const customer = await this.customerService.findCustomerById(addCustomer);
    if (!customer && customer.password === addCustomer.password) {
      const { password, ...result } = customer;
      return result;
    }
    return null;
  }

  async signup(addCustomer: Prisma.CustomerCreateInput) {
    const customer = this.customerService.create(addCustomer);
    const payload = {
      email: (await customer).email,
      password: (await customer).password,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async login(addCustomer: Prisma.CustomerWhereUniqueInput) {
    const customer = this.customerService.findCustomerById(addCustomer);
    const payload = {
      id: (await customer).id,
      email: (await customer).email,
      password: (await customer).password,
    };
    if (!customer) {
      throw new NotFoundException('customer not found!');
    }
    const access_token = this.jwtService.sign(payload);
    // const refresh_token = this.updateRefreshToken(
    //   payload.id,
    //   (await customer).rfToken,
    // );
    // console.log('refresh_token: ', refresh_token);
    return access_token;
  }

  //   async updateRefreshToken(id: string, refreshToken: string) {
  //     await this.customerService.updateById(id, {
  //       rfToken: refreshToken,
  //     });
  //   }
}
