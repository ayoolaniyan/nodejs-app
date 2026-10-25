import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { requestFromContext } from './request-from-context';

/** Requires a valid access token, on REST routes and GraphQL resolvers. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    return requestFromContext(context);
  }
}
