import { Args, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Customer } from 'src/lib/entities/customer.entity';
import { CustomerService } from './customer.service';
import { ListCustomersInput } from './dto/customer.input';
import { JwtAuthGuard } from 'src/authentication/jwt-auth.guard';

@Resolver(() => Customer)
@UseGuards(JwtAuthGuard)
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  @Query(() => [Customer])
  customers(
    @Args('input', { nullable: true }) input?: ListCustomersInput,
  ): Promise<Customer[]> {
    return this.customerService.findAll({
      skip: input?.skip,
      take: input?.take,
    }) as Promise<Customer[]>;
  }
}
