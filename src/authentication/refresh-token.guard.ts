import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Requires a valid refresh token, verified with JWT_REFRESH_SECRET. */
@Injectable()
export class RefreshTokenGuard extends AuthGuard('jwt-refresh') {}
