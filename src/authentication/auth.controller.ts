import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthenticatedCustomer, AuthService, Tokens } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { RefreshTokenPrincipal } from './refresh-token.strategy';
import { LoginDto, SignupDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Public by design — requiring a token to obtain a token would make login
   * impossible.
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  signup(@Body() body: SignupDto): Promise<Tokens> {
    return this.authService.signup(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto): Promise<Tokens> {
    return this.authService.login(body);
  }

  /**
   * Takes the refresh token as the bearer token and returns a new pair. The
   * presented refresh token is then no longer accepted.
   */
  @ApiBearerAuth()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() request: Request): Promise<Tokens> {
    const { sub, refreshToken } = request.user as RefreshTokenPrincipal;
    return this.authService.refreshTokens(sub, refreshToken);
  }

  /**
   * Revokes the refresh token. The access token stays valid until it
   * expires (JWT_EXPIRES_IN), so keep that short.
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() request: Request): Promise<void> {
    return this.authService.logout((request.user as AuthenticatedCustomer).id);
  }

  /** Returns the customer behind the presented access token. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() request: Request) {
    return request.user;
  }
}
