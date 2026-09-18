import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerService } from 'src/customer/customer.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

export type Tokens = {
  access_token: string;
  refresh_token: string;
};

/**
 * Claims carried by both tokens. `sub` is the customer id — never the
 * password or its hash, since a JWT payload is readable by anyone holding
 * the token.
 */
export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly customerService: CustomerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Looks up a customer by email and returns them without the password hash.
   * Used by the JWT strategy to turn a token's claims back into a customer.
   */
  async validateCustomer(where: Prisma.CustomerWhereUniqueInput) {
    const customer = await this.customerService.findCustomerEmail(where);
    if (!customer) {
      return null;
    }
    const { password: _password, ...safeCustomer } = customer;
    return safeCustomer;
  }

  async signup(input: Prisma.CustomerCreateInput): Promise<Tokens> {
    const existing = await this.customerService.findCustomerEmail({
      email: input.email,
    });
    if (existing) {
      // Deliberately the same wording the login path uses, so that signup
      // cannot be used to enumerate which email addresses are registered.
      throw new ConflictException('Unable to create account');
    }

    const customer = await this.customerService.create({
      email: input.email,
      password: await argon2.hash(input.password),
    });

    return this.getTokens(customer.id, customer.email, customer.role);
  }

  async login(credentials: Prisma.CustomerWhereUniqueInput): Promise<Tokens> {
    const customer = await this.customerService.findCustomerEmail({
      email: credentials.email,
    });

    // One error for "no such customer" and "wrong password" alike: telling
    // them apart hands an attacker a list of valid accounts.
    if (!customer) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await argon2.verify(
      customer.password,
      String(credentials.password),
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.getTokens(customer.id, customer.email, customer.role);
  }

  async getTokens(id: string, email: string, role: string): Promise<Tokens> {
    const payload: JwtPayload = { sub: id, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refreshTokens(email: string): Promise<Tokens> {
    const customer = await this.customerService.findCustomerEmail({ email });
    if (!customer) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.getTokens(customer.id, customer.email, customer.role);
  }
}
