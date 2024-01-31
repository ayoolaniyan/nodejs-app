import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { WhereCustomerInput } from './dto/customer.input';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}
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

  async findCustomerEmail(customer: Prisma.CustomerWhereUniqueInput) {
    return this.prisma.customer.findUnique({
      where: {
        email: customer.email,
        password: customer.password,
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
