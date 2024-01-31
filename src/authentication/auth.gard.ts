import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor() {
    super();
  }
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  handleRequest(err: any, customer: any): any {
    console.log('iu', customer);
    if (err || !customer) {
      throw err || new UnauthorizedException('you are not authorized!');
    }
    return customer;
  }
}
