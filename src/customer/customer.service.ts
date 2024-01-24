import { Body, Injectable, Param } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { WhereCustomerInput } from './dto/customer.input';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private prisma: PrismaService) {}
  async findAll() {
    return this.prisma.customer.findMany();
  }
  // async findAll(params: GetCustomerInput) {
  //   const { skip, take, cursor, where } = params;

  //   return this.prisma.customer.findMany({
  //     skip,
  //     take,
  //     cursor,
  //     where,
  //   });
  // }

  async findCustomerById(customer: Prisma.CustomerWhereUniqueInput) {
    return this.prisma.customer.findUnique({
      where: {
        email: customer.email,
        password: customer.password,
        rfToken: customer.rfToken,
      },
    });
  }

  async create(addCustomer: Prisma.CustomerCreateInput) {
    return this.prisma.customer.create({
      data: addCustomer,
    });
  }

  async updateById(id: string, updateCustomer: WhereCustomerInput) {
    return this.prisma.customer.update({
      where: { id: id },
      data: updateCustomer,
    });
  }

  async deleteById(id: Prisma.CustomerWhereUniqueInput) {
    return this.prisma.customer.delete({
      where: id,
    });
  }
}
