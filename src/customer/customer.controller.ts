import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CustomerService } from './customer.service';
import { ListCustomersInput, UpdateCustomerInput } from './dto/customer.input';
import { JwtAuthGuard } from 'src/authentication/jwt-auth.guard';
import { RolesGuard } from 'src/authentication/role/roles.guard';
import { Roles } from 'src/authentication/role/decorators/roles.decorator';
import { Role } from 'src/authentication/role/enums/role.enum';
import { AuthenticatedCustomer } from 'src/authentication/auth.service';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /** Listing every customer is admin-only; a customer reads their own record. */
  @Roles(Role.ADMIN)
  @Get()
  list(@Query() query: ListCustomersInput) {
    return this.customerService.findAll(query);
  }

  /**
   * Previously this was `GET /customer` reading the email from the request
   * body. Bodies on GET requests are dropped by many proxies and clients,
   * so the identifier belongs in the path.
   */
  @Get(':id')
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: Request,
  ) {
    this.assertSelfOrAdmin(request, id);
    const customer = await this.customerService.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateCustomerInput,
    @Req() request: Request,
  ) {
    this.assertSelfOrAdmin(request, id);
    return this.customerService.updateById(id, data);
  }

  /**
   * Deleting a customer is admin-only. The guard on the previous version of
   * this handler was commented out, leaving the endpoint open to anyone.
   */
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.deleteById(id);
  }

  /**
   * A customer may only act on their own record; an admin may act on any.
   * Without this, any logged-in customer could read or rewrite another's.
   */
  private assertSelfOrAdmin(request: Request, id: string) {
    const caller = request.user as AuthenticatedCustomer;
    if (caller.role !== Role.ADMIN && caller.id !== id) {
      throw new ForbiddenException();
    }
  }
}
