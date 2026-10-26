import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { Request } from 'express';

import { AuthService } from 'src/authentication/auth.service';
import { AccessTokenStrategy } from 'src/authentication/access-token.strategy';
import { CustomerController } from 'src/customer/customer.controller';
import { CustomerResolver } from 'src/customer/customer.resolver';
import { CustomerService } from 'src/customer/customer.service';

/**
 * Authorisation on the customer endpoints, over REST and GraphQL, with the
 * persistence layer replaced by an in-memory double.
 */
describe('Customers (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const alice = {
    id: 'ff1b0c1e-0000-4000-8000-000000000001',
    email: 'alice@example.com',
    role: 'USER',
  };
  const bob = {
    id: 'ff1b0c1e-0000-4000-8000-000000000002',
    email: 'bob@example.com',
    role: 'USER',
  };
  const admin = {
    id: 'ff1b0c1e-0000-4000-8000-000000000003',
    email: 'admin@example.com',
    role: 'ADMIN',
  };
  const everyone = [alice, bob, admin];

  const customerService = {
    findAll: jest.fn(),
    findById: jest.fn(),
    updateById: jest.fn(),
    deleteById: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({ secret: process.env.JWT_SECRET }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          context: ({ req }: { req: Request }) => ({ req }),
        }),
      ],
      controllers: [CustomerController],
      providers: [
        CustomerResolver,
        AccessTokenStrategy,
        { provide: AuthService, useValue: authServiceDouble() },
        { provide: CustomerService, useValue: customerService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    customerService.findAll.mockResolvedValue(
      everyone.map((c) => ({
        ...c,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
    customerService.findById.mockImplementation(async (id: string) =>
      everyone.find((c) => c.id === id),
    );
    customerService.updateById.mockImplementation(
      async (id: string, data: object) => ({
        ...everyone.find((c) => c.id === id),
        ...data,
      }),
    );
  });

  /** The access-token strategy only needs to resolve `sub` to a customer. */
  function authServiceDouble() {
    return {
      validateCustomer: async (id: string) =>
        everyone.find((c) => c.id === id) ?? null,
    };
  }

  function tokenFor(customer: { id: string; email: string; role: string }) {
    return jwtService.sign(
      { sub: customer.id, email: customer.email, role: customer.role },
      { secret: process.env.JWT_SECRET },
    );
  }

  function get(path: string, as: typeof alice) {
    return request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${tokenFor(as)}`);
  }

  function patch(path: string, as: typeof alice, body: object) {
    return request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${tokenFor(as)}`)
      .send(body);
  }

  describe('REST', () => {
    it('lets a customer read their own record', async () => {
      const response = await get(`/customers/${alice.id}`, alice).expect(200);
      expect(response.body).toMatchObject({ id: alice.id });
    });

    it("forbids a customer from reading someone else's record", async () => {
      await get(`/customers/${bob.id}`, alice).expect(403);
      expect(customerService.findById).not.toHaveBeenCalled();
    });

    it("forbids a customer from updating someone else's record", async () => {
      await patch(`/customers/${bob.id}`, alice, {
        email: 'stolen@example.com',
      }).expect(403);
      expect(customerService.updateById).not.toHaveBeenCalled();
    });

    it('lets a customer update their own record', async () => {
      await patch(`/customers/${alice.id}`, alice, {
        email: 'alice2@example.com',
      }).expect(200);
      expect(customerService.updateById).toHaveBeenCalledWith(alice.id, {
        email: 'alice2@example.com',
      });
    });

    it('lets an admin read and update any record', async () => {
      await get(`/customers/${bob.id}`, admin).expect(200);
      await patch(`/customers/${bob.id}`, admin, {
        email: 'bob2@example.com',
      }).expect(200);
    });

    it('restricts the customer list to admins', async () => {
      await get('/customers', alice).expect(403);
      await get('/customers', admin).expect(200);
    });

    it('passes validated paging to the service as numbers', async () => {
      await get('/customers?skip=10&take=5', admin).expect(200);
      expect(customerService.findAll).toHaveBeenCalledWith({
        skip: 10,
        take: 5,
      });
    });

    it.each(['skip=-1', 'take=0', 'take=101', 'take=abc'])(
      'rejects invalid paging (%s) with 400',
      async (query) => {
        await get(`/customers?${query}`, admin).expect(400);
        expect(customerService.findAll).not.toHaveBeenCalled();
      },
    );

    it('rejects an id that is not a UUID with 400', async () => {
      await get('/customers/not-a-uuid', admin).expect(400);
    });

    it('returns 404 for a customer that does not exist', async () => {
      await get(
        '/customers/ff1b0c1e-0000-4000-8000-0000000000ff',
        admin,
      ).expect(404);
    });

    it('lets an admin delete a customer', async () => {
      customerService.deleteById.mockResolvedValue(bob);

      await request(app.getHttpServer())
        .delete(`/customers/${bob.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);
      expect(customerService.deleteById).toHaveBeenCalledWith(bob.id);
    });

    it('forbids a customer from deleting, even their own record', async () => {
      await request(app.getHttpServer())
        .delete(`/customers/${alice.id}`)
        .set('Authorization', `Bearer ${tokenFor(alice)}`)
        .expect(403);
      expect(customerService.deleteById).not.toHaveBeenCalled();
    });

    it('requires a token', async () => {
      await request(app.getHttpServer())
        .get(`/customers/${alice.id}`)
        .expect(401);
    });

    it('rejects a valid token once its customer has been deleted', async () => {
      // The signature and expiry are fine; the strategy re-reads the
      // customer on every request, so deletion takes effect immediately.
      const deleted = {
        id: 'ff1b0c1e-0000-4000-8000-0000000000dd',
        email: 'deleted@example.com',
        role: 'USER',
      };

      await get(`/customers/${deleted.id}`, deleted).expect(401);
    });
  });

  describe('GraphQL', () => {
    const query = '{ customers { id email } }';

    function graphql(token?: string) {
      const req = request(app.getHttpServer()).post('/graphql');
      if (token) {
        req.set('Authorization', `Bearer ${token}`);
      }
      return req.send({ query });
    }

    it('returns customers to an admin with a valid token', async () => {
      const response = await graphql(tokenFor(admin)).expect(200);

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.customers).toHaveLength(everyone.length);
    });

    it('rejects a request without a token', async () => {
      const response = await graphql();

      expect(response.body.data).toBeNull();
      expect(response.body.errors[0].message).toMatch(/unauthorized/i);
    });

    it('rejects a non-admin', async () => {
      const response = await graphql(tokenFor(alice));

      expect(response.body.data).toBeNull();
      expect(response.body.errors[0].message).toMatch(/forbidden/i);
    });
  });
});
