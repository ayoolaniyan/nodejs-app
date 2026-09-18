import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from 'src/prisma.service';
import { CustomerResolver } from './customer.resolver';
import { CustomerController } from './customer.controller';

@Module({
  controllers: [CustomerController],
  providers: [CustomerService, PrismaService, CustomerResolver],
  // Exported so AuthModule can reuse the same service rather than
  // re-registering CustomerService and PrismaService as its own providers,
  // which would give the two modules separate Prisma connections.
  exports: [CustomerService],
})
export class CustomerModule {}
