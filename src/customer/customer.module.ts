import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { PrismaService } from 'src/prisma.service';
import { CustomerResolver } from './customer.resolver';
import { CustomerController } from './customer.controller';

@Module({
  imports: [],
  controllers: [CustomerController],
  providers: [CustomerService, PrismaService, CustomerResolver],
})
export class CustomerModule {}
