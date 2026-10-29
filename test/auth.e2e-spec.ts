import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as argon2 from 'argon2';

import { AuthController } from 'src/authentication/auth.controller';
import { AuthService } from 'src/authentication/auth.service';
import { AccessTokenStrategy } from 'src/authentication/access-token.strategy';
import { RefreshTokenStrategy } from 'src/authentication/refresh-token.strategy';
import { CustomerService } from 'src/customer/customer.service';

/**
 * Exercises the authentication endpoints over real HTTP, including the
 * global ValidationPipe, with the persistence layer replaced by an in-memory
 * double. No Postgres required, so this runs in CI unchanged.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;

  const password = 'local-dev-password';
  const customer = {
    id: 'ff1b0c1e-0000-4000-8000-000000000001',
    email: 'customer@example.com',
    password: '',
    role: 'USER',
    refreshTokenHash: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const customerService = {
    findCustomerEmail: jest.fn(),
    findById: jest.fn(),
    findAuthRecordById: jest.fn(),
    create: jest.fn(),
    setRefreshTokenHash: jest.fn(),
  };

  beforeAll(async () => {
    customer.password = await argon2.hash(password);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule,
        JwtModule.register({ secret: process.env.JWT_SECRET }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        AccessTokenStrategy,
        RefreshTokenStrategy,
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    customer.refreshTokenHash = null;

    // Behave like the database: the refresh token hash written by one call
    // is the one read back by the next.
    customerService.findCustomerEmail.mockImplementation(async () => customer);
    customerService.findAuthRecordById.mockImplementation(async () => customer);
    customerService.setRefreshTokenHash.mockImplementation(
      async (_id: string, hash: string | null) => {
        customer.refreshTokenHash = hash;
      },
    );
    customerService.findById.mockImplementation(async () => {
      const { password: _p, refreshTokenHash: _r, ...safe } = customer;
      return safe;
    });
  });

  function login() {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customer.email, password })
      .expect(200);
  }

  function refresh(refreshToken: string) {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${refreshToken}`);
  }

  it('logs in with valid credentials and returns both tokens', async () => {
    const response = await login();

    expect(response.body).toEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('rejects a wrong password with 401, not 500', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customer.email, password: 'wrong' })
      .expect(401);
  });

  it('rejects a malformed email before it reaches the service', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password })
      .expect(400);

    expect(customerService.findCustomerEmail).not.toHaveBeenCalled();
  });

  it('strips unknown fields rather than passing them to the database', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'new@example.com', password, role: 'ADMIN' })
      .expect(400);

    expect(customerService.create).not.toHaveBeenCalled();
  });

  it('signs up a new customer and returns both tokens', async () => {
    customerService.findCustomerEmail.mockResolvedValue(null);
    customerService.create.mockImplementation(
      async (data: { email: string; password: string }) => ({
        ...customer,
        ...data,
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'new@example.com', password })
      .expect(201);

    expect(response.body).toEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('rejects a signup password shorter than 12 characters', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'new@example.com', password: 'short' })
      .expect(400);

    expect(customerService.create).not.toHaveBeenCalled();
  });

  it('requires a bearer token on /auth/me', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the customer behind a valid access token', async () => {
    const { body: tokens } = await login();

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .expect(200);

    expect(me.body).toMatchObject({ id: customer.id, email: customer.email });
    expect(me.body).not.toHaveProperty('password');
    expect(me.body).not.toHaveProperty('refreshTokenHash');
    expect(customerService.findById).toHaveBeenCalledWith(customer.id);
  });

  describe('POST /auth/refresh', () => {
    it('exchanges a refresh token for a new pair', async () => {
      const { body: tokens } = await login();

      const response = await refresh(tokens.refresh_token).expect(200);

      expect(response.body).toEqual({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
      });
    });

    it('accepts each refresh token only once', async () => {
      const { body: tokens } = await login();

      await refresh(tokens.refresh_token).expect(200);
      await refresh(tokens.refresh_token).expect(401);
    });

    it('rejects an access token presented as a refresh token', async () => {
      const { body: tokens } = await login();

      await refresh(tokens.access_token).expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('revokes the refresh token', async () => {
      const { body: tokens } = await login();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokens.access_token}`)
        .expect(204);

      await refresh(tokens.refresh_token).expect(401);
    });

    it('requires an access token', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
