import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from 'src/prisma.service';
import { UpdateCustomerInput } from './dto/customer.input';

/**
 * Columns returned to callers — the password hash and refresh token hash are
 * never among them.
 */
const publicCustomerFields = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

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

  /**
   * Returns the full record including both hashes. Only the authentication
   * layer should call this.
   */
  findAuthRecordById(id: string) {
    return this.prisma.customer.findUnique({ where: { id } });
  }

  async create(data: Prisma.CustomerCreateInput) {
    try {
      return await this.prisma.customer.create({ data });
    } catch (error) {
      // Reached when two signups for one email race past the existence check
      // in AuthService.signup; worded the same as that check.
      throw this.translatePrismaError(error, {
        conflict: 'Unable to create account',
      });
    }
  }

  async updateById(id: string, data: UpdateCustomerInput) {
    try {
      return await this.prisma.customer.update({
        where: { id },
        data,
        select: publicCustomerFields,
      });
    } catch (error) {
      throw this.translatePrismaError(error, {
        notFound: `Customer ${id} not found`,
        conflict: 'Email is already in use',
      });
    }
  }

  async deleteById(id: string) {
    try {
      return await this.prisma.customer.delete({
        where: { id },
        select: publicCustomerFields,
      });
    } catch (error) {
      throw this.translatePrismaError(error, {
        notFound: `Customer ${id} not found`,
      });
    }
  }

  /** Stores the hash of the customer's current refresh token, or clears it. */
  async setRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    await this.prisma.customer.update({
      where: { id },
      data: { refreshTokenHash },
    });
  }

  /**
   * Maps the Prisma errors a caller can cause to HTTP errors; anything else
   * is passed through and surfaces as a 500.
   *
   * P2025 is a missing row. P2002 is a unique constraint violation, and email
   * is the only unique column a caller can write, so it means the email is
   * taken. Previously both surfaced as 500s.
   */
  private translatePrismaError(
    error: unknown,
    messages: { notFound?: string; conflict?: string },
  ): unknown {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025' && messages.notFound) {
        return new NotFoundException(messages.notFound);
      }
      if (error.code === 'P2002' && messages.conflict) {
        return new ConflictException(messages.conflict);
      }
    }
    return error;
  }
}
