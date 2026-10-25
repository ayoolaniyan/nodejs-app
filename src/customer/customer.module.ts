import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerResolver } from './customer.resolver';
import { CustomerController } from './customer.controller';

@Module({
  controllers: [CustomerController],
  // PrismaService comes from the global PrismaModule.
  providers: [CustomerService, CustomerResolver],
  // Exported so AuthModule can reuse the same service rather than
  // re-registering CustomerService as its own provider.
  exports: [CustomerService],
})
export class CustomerModule {}
