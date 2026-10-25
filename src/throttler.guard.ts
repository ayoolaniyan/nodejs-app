import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { requestFromContext } from './authentication/request-from-context';

/**
 * ThrottlerGuard that also works for GraphQL. The stock guard reads the
 * request with `switchToHttp()`, which finds nothing inside a resolver, so
 * as a global guard it would fail every GraphQL call.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected getRequestResponse(context: ExecutionContext) {
    const req = requestFromContext(context);
    return { req, res: req.res as Response };
  }
}
