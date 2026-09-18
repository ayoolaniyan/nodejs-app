import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Passport has already verified the signature and expiry by this point.
   * The customer is re-read from the database so that a token issued before
   * an account was deleted or its role changed does not keep working.
   */
  async validate(payload: JwtPayload) {
    const customer = await this.authService.validateCustomer({
      email: payload.email,
    });
    if (!customer) {
      throw new UnauthorizedException();
    }
    return customer;
  }
}
