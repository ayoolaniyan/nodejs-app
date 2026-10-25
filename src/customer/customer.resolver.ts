import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Customer } from 'src/lib/entities/customer.entity';
import { CustomerService } from './customer.service';
import { ListCustomersInput } from './dto/customer.input';
import { JwtAuthGuard } from 'src/authentication/jwt-auth.guard';
import { RolesGuard } from 'src/authentication/role/roles.guard';
import { Roles } from 'src/authentication/role/decorators/roles.decorator';
import { Role } from 'src/authentication/role/enums/role.enum';

@Resolver(() => Customer)
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  /** Admin-only, matching `GET /customers`. */
  @Roles(Role.ADMIN)
  @Query(() => [Customer])
  customers(
    @Args('input', { nullable: true }) input?: ListCustomersInput,
  ): Promise<Customer[]> {
    return this.customerService.findAll({
      skip: input?.skip,
      take: input?.take,
    });
  }
}
