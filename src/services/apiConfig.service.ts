import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiConfigService {
  constructor(private configService: ConfigService) {}

  get accessTokenConfig(): any {
    return {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: eval(this.configService.get('JWT_EXPIRES_IN')),
    };
  }
  get refreshTokenConfig(): any {
    return {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: eval(this.configService.get('JWT_EXPIRES_IN')),
    };
  }
}
