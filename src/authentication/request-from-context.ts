import { ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';

/**
 * Returns the HTTP request behind either a REST or a GraphQL call.
 *
 * `context.switchToHttp().getRequest()` only works for REST: in a resolver
 * the first handler argument is the GraphQL root value, so guards that use it
 * see no request and reject every GraphQL call.
 */
export function requestFromContext(context: ExecutionContext): Request {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext().req;
  }
  return context.switchToHttp().getRequest();
}
