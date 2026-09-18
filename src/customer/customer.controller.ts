import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { UpdateCustomerInput } from './dto/customer.input';
import { JwtAuthGuard } from 'src/authentication/jwt-auth.guard';
import { RolesGuard } from 'src/authentication/role/roles.guard';
import { Roles } from 'src/authentication/role/decorators/roles.decorator';
import { Role } from 'src/authentication/role/enums/role.enum';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  list(
    @Query('skip', new DefaultValuePipe(0), ParseIntPipe) skip: number,
    @Query('take', new DefaultValuePipe(25), ParseIntPipe) take: number,
  ) {
    return this.customerService.findAll({ skip, take });
  }

  /**
   * Previously this was `GET /customer` reading the email from the request
   * body. Bodies on GET requests are dropped by many proxies and clients,
   * so the identifier belongs in the path.
   */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const customer = await this.customerService.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: UpdateCustomerInput) {
    return this.customerService.updateById(id, data);
  }

  /**
   * Deleting a customer is admin-only. The guard on the previous version of
   * this handler was commented out, leaving the endpoint open to anyone.
   */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerService.deleteById(id);
  }
}
