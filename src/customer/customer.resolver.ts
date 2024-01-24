import { Query, Resolver } from '@nestjs/graphql';
import { Customer } from 'lib/entities/customer.entity';
import { CustomerService } from './customer.service';
// import { GetCustomerInput } from './dto/customer.input';

@Resolver(() => Customer)
export class CustomerResolver {
  constructor(private readonly customerService: CustomerService) {}

  @Query(() => [Customer])
  async customers() {
    return this.customerService.findAll();
  }
  // @Query(() => [Customer])
  // async customers(@Args('data') { skip, take, where }: GetCustomerInput) {
  //   return this.customerService.findAll({ skip, take, where });
  // }
}
