import {
  Body,
  Controller,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './auth.gard';
import { LocalAuthGuard } from './local-auth.guard';
// import { LocalAuthGuard } from './local-auth.guard';
// import { JwtAuthGuard } from './auth.gard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  //   @UseGuards(LocalAuthGuard)
  //   @UseGuards(JwtAuthGuard)
  @Post('login')
  login(
    @Req() request: Request,
    @Res() response: Response,
    @Body() addCustomer: Prisma.CustomerWhereUniqueInput,
  ) {
    try {
      const result = this.authService.login(addCustomer);
      result.then((data) => {
        console.log('controller: ', data);
        return response.status(200).json({
          status: 'Ok!',
          message: 'Successfully login!',
          access_token: data,
        });
      });
    } catch (error) {
      return response.status(500).json({
        status: 'Error!',
        message: 'Internal Server Error!',
      });
    }
  }

  //   @UseGuards(LocalAuthGuard)
  //   @UseGuards(JwtAuthGuard)
  @Post('signup')
  signup(
    @Req() request: Request,
    @Res() response: Response,
    @Body() addCustomer: Prisma.CustomerCreateInput,
  ) {
    try {
      const result = this.authService.signup(addCustomer);
      return response.status(200).json({
        status: 'Ok!',
        message: 'Successfully Signup!',
        access_token: result,
      });
    } catch (error) {
      return response.status(500).json({
        status: 'Error!',
        message: 'Internal Server Error!',
      });
    }
  }
}
