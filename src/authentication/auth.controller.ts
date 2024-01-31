import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { JwtAuthGuard } from './auth.gard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Post('login')
  async login(
    @Req() request: Request,
    @Res() response: Response,
    @Body() addCustomer: Prisma.CustomerWhereUniqueInput,
  ) {
    try {
      const result = await this.authService.login(addCustomer);
      console.log('controller: ', result);
      return response.status(200).json({
        status: 'Ok!',
        message: 'Successfully login!',
        access_token: result,
      });
    } catch (error) {
      return response.status(500).json({
        status: 'Error!',
        message: 'Internal Server Error!',
      });
    }
  }

  @Post('signup')
  async signup(
    @Req() request: Request,
    @Res() response: Response,
    @Body() addCustomer: Prisma.CustomerCreateInput,
  ) {
    try {
      const result = await this.authService.signup(addCustomer);
      console.log('result', result);
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
  @Post('validate')
  async validateUser(
    @Req() request: Request,
    @Res() response: Response,
    @Body() addCustomer: Prisma.CustomerCreateInput,
  ) {
    try {
      const result = await this.authService.validateCustomer(addCustomer);
      console.log('result', result);
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
