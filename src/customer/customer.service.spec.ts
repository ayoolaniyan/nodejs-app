import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CustomerService } from './customer.service';
import { PrismaService } from 'src/prisma.service';

function prismaError(code: string) {
  return new PrismaClientKnownRequestError('prisma error', {
    code,
    clientVersion: 'test',
  });
}

describe('CustomerService', () => {
  const id = 'ff1b0c1e-0000-4000-8000-000000000001';
  let prisma: {
    customer: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };
  let service: CustomerService;

  beforeEach(() => {
    prisma = {
      customer: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    service = new CustomerService(prisma as unknown as PrismaService);
  });

  it('turns a duplicate email on create into 409, not 500', async () => {
    // Two concurrent signups can both pass the existence check in
    // AuthService.signup; the database's unique index catches the second.
    prisma.customer.create.mockRejectedValue(prismaError('P2002'));

    await expect(
      service.create({ email: 'taken@example.com', password: 'hash' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('turns a duplicate email on update into 409, not 500', async () => {
    prisma.customer.update.mockRejectedValue(prismaError('P2002'));

    await expect(
      service.updateById(id, { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('turns a missing row on update or delete into 404', async () => {
    prisma.customer.update.mockRejectedValue(prismaError('P2025'));
    prisma.customer.delete.mockRejectedValue(prismaError('P2025'));

    await expect(service.updateById(id, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.deleteById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('passes other errors through unchanged', async () => {
    const unexpected = new Error('connection lost');
    prisma.customer.update.mockRejectedValue(unexpected);

    await expect(service.updateById(id, {})).rejects.toBe(unexpected);
  });

  it('never selects either hash into a returned customer', async () => {
    prisma.customer.update.mockResolvedValue({});

    await service.updateById(id, {});

    const { select } = prisma.customer.update.mock.calls[0][0];
    expect(select).not.toHaveProperty('password');
    expect(select).not.toHaveProperty('refreshTokenHash');
  });
});
