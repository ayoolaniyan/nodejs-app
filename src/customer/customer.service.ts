import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma.service';
import { UpdateCustomerInput } from './dto/customer.input';

/** Columns returned to callers — the password hash is never among them. */
const publicCustomerFields: Prisma.CustomerSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(params: { skip?: number; take?: number } = {}) {
    const { skip = 0, take = 25 } = params;
    return this.prisma.customer.findMany({
      skip,
      // Capped so that a caller cannot ask for the entire table in one query.
      take: Math.min(take, 100),
      orderBy: { createdAt: 'desc' },
      select: publicCustomerFields,
    });
  }

  /**
   * Returns the full record including the password hash. Only the
   * authentication layer should call this.
   */
  findCustomerEmail(where: Prisma.CustomerWhereUniqueInput) {
    return this.prisma.customer.findUnique({
      where: { email: where.email },
    });
  }

  findById(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      select: publicCustomerFields,
    });
  }

  create(data: Prisma.CustomerCreateInput) {
    return this.prisma.customer.create({ data });
  }

  async updateById(id: string, data: UpdateCustomerInput) {
    try {
      return await this.prisma.customer.update({
        where: { id },
        data,
        select: publicCustomerFields,
      });
    } catch (error) {
      throw this.translatePrismaError(error, id);
    }
  }

  async deleteById(id: string) {
    try {
      return await this.prisma.customer.delete({
        where: { id },
        select: publicCustomerFields,
      });
    } catch (error) {
      throw this.translatePrismaError(error, id);
    }
  }

  /**
   * Prisma reports a missing row as P2025. Previously this surfaced as a
   * 403 "Credentials incorrect", which is neither the right status nor an
   * accurate description of what happened.
   */
  private translatePrismaError(error: unknown, id: string): unknown {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return new NotFoundException(`Customer ${id} not found`);
    }
    return error;
  }
}
