import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { WhereCustomerInput } from './dto/customer.input';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class CustomerService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async findAll() {
    const result = this.prisma.customer.findMany().catch((error) => {
      if (error instanceof PrismaClientKnownRequestError) {
        throw new ForbiddenException('Credentials incorrect');
      }
      throw error;
    });
    return result;
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
    const result = this.prisma.customer
      .findUnique({
        where: {
          email: customer.email,
          password: customer.password,
        },
      })
      .catch((error) => {
        if (error instanceof PrismaClientKnownRequestError) {
          throw new ForbiddenException('Credentials incorrect');
        }
        throw error;
      });
    return result;
  }

  async create(addCustomer: Prisma.CustomerCreateInput) {
    const result = this.prisma.customer.create({
      data: addCustomer,
    });
    // .catch((error) => {
    //   if (error instanceof PrismaClientKnownRequestError) {
    //     throw new ForbiddenException('Could not create account');
    //   }
    //   throw error;
    // });
    return result;
  }

  async updateById(id: string, updateCustomer: WhereCustomerInput) {
    const result = this.prisma.customer
      .update({
        where: { id: id },
        data: updateCustomer,
      })
      .catch((error) => {
        if (error instanceof PrismaClientKnownRequestError) {
          throw new ForbiddenException('Credentials incorrect');
        }
        throw error;
      });
    return result;
  }

  async deleteById(id: Prisma.CustomerWhereUniqueInput) {
    const result = this.prisma.customer
      .delete({
        where: id,
      })
      .catch((error) => {
        if (error instanceof PrismaClientKnownRequestError) {
          throw new ForbiddenException('Credentials incorrect');
        }
        throw error;
      });
    return result;
  }
}
