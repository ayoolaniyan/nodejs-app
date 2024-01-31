import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerService } from 'src/customer/customer.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiConfigService } from 'src/services/apiConfig.service';
// import * as argon2 from 'argon2';

type Tokens = {
  access_token: string;
  refresh_token: string;
};

type JwtPayload = {
  email: string;
  sub: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly customerService: CustomerService,
    private configService: ConfigService,
    private apiConfigService: ApiConfigService,
  ) {}

  async validateCustomer(addCustomer: Prisma.CustomerWhereUniqueInput) {
    const customer = await this.customerService.findCustomerEmail(addCustomer);
    if (customer && customer.email === addCustomer.email) {
      const { email, ...result } = customer;
      return result;
    }
    return null;
  }

  async signup(addCustomer: Prisma.CustomerCreateInput) {
    // const hashPassword = await argon2.hash((await addCustomer).password);
    const payload: Prisma.CustomerCreateInput = {
      email: (await addCustomer).email,
      password: (await addCustomer).password,
    };
    const customer = this.customerService.create(payload);
    const accessToken = await this.getTokens(
      (
        await customer
      ).email,
      (
        await customer
      ).password,
    );
    return accessToken;
  }

  async login(addCustomer: Prisma.CustomerWhereUniqueInput) {
    const customer = await this.customerService.findCustomerEmail(addCustomer);
    if (!customer) throw new ForbiddenException('Access Denied');

    const payload = {
      email: customer.email,
      sub: customer.password,
    };
    const accessToken = await this.getTokens(
      (
        await customer
      ).email,
      (
        await customer
      ).password,
    );
    console.log('payload', payload);
    console.log('token', accessToken);

    this.jwtService.signAsync(payload);
    return accessToken;
  }

  async getTokens(email: string, password: string): Promise<Tokens> {
    const jwtPayload: JwtPayload = {
      sub: password,
      email: email,
    };
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(jwtPayload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      }),
    ]);
    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  async refreshTokens(email: string): Promise<Tokens> {
    const customer = await this.customerService.findCustomerEmail({ email });

    const tokens = await this.getTokens(customer.email, customer.password);
    // await this.updateRtHash(customer.email, tokens.refresh_token);

    return tokens;
  }

  // async updateRtHash(email: string, rt: string): Promise<void> {
  //   await this.prisma.user.update({
  //     where: {
  //       id: userId,
  //     },
  //     data: {
  //       hashedRt: hash,
  //     },
  //   });
  // }
}
