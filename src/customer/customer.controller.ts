import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { WhereCustomerInput } from './dto/customer.input';
import { Prisma } from '@prisma/client';
import { RolesGuard } from 'src/authentication/role/roles.guard';
import { Roles } from 'src/authentication/role/decorators/roles.decorator';
import { Role } from 'src/authentication/role/enums/role.enum';

@Controller()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post('/customer')
  addCustomer(@Body() data: Prisma.CustomerCreateInput) {
    return this.customerService.create(data);
  }

  @Get('/customers')
  getCustomers() {
    return this.customerService.findAll();
  }

  @Get('/customer')
  getCustomer(@Body() email: Prisma.CustomerWhereUniqueInput) {
    return this.customerService.findCustomerEmail(email);
  }

  @Roles(Role.USER)
  @UseGuards(RolesGuard)
  @Patch(':id')
  updateCustomer(@Param('id') id: string, @Body() data: WhereCustomerInput) {
    return this.customerService.updateById(id, data);
  }

  @Roles(Role.USER)
  @UseGuards(RolesGuard)
  @Delete(':id')
  deleteCustomer(@Param() id: Prisma.CustomerWhereUniqueInput) {
    return this.customerService.deleteById(id);
  }
}
