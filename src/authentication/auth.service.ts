import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomerService } from 'src/customer/customer.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
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

/** What the access-token strategy places on `request.user`. */
export type AuthenticatedCustomer = {
  id: string;
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
   * Looks up the customer a token's `sub` claim names, without either hash.
   * Used by the JWT strategy to turn a token back into a customer. The id is
   * used rather than the email claim because the email can change.
   */
  validateCustomer(id: string) {
    return this.customerService.findById(id);
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

    return this.issueTokens(customer);
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

    return this.issueTokens(customer);
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
        // Makes every refresh token unique. Without it, two tokens issued in
        // the same second are byte-identical, and rotation could not tell
        // the replaced token from its replacement.
        jwtid: randomUUID(),
      }),
    ]);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  /**
   * Exchanges a refresh token for a new pair and rotates it: only the most
   * recently issued refresh token is accepted, so a stolen one stops working
   * as soon as the customer refreshes or logs out.
   */
  async refreshTokens(
    customerId: string,
    refreshToken: string,
  ): Promise<Tokens> {
    const customer = await this.customerService.findAuthRecordById(customerId);

    // No stored hash means the customer logged out, or was never issued a
    // token since this column was added.
    const tokenMatches =
      !!customer?.refreshTokenHash &&
      (await argon2.verify(customer.refreshTokenHash, refreshToken));
    if (!tokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueTokens(customer);
  }

  /** Revokes the customer's refresh token. */
  async logout(customerId: string): Promise<void> {
    await this.customerService.setRefreshTokenHash(customerId, null);
  }

  /** Signs a token pair and records the refresh token as the valid one. */
  private async issueTokens(customer: {
    id: string;
    email: string;
    role: string;
  }): Promise<Tokens> {
    const tokens = await this.getTokens(
      customer.id,
      customer.email,
      customer.role,
    );
    await this.customerService.setRefreshTokenHash(
      customer.id,
      await argon2.hash(tokens.refresh_token),
    );
    return tokens;
  }
}
