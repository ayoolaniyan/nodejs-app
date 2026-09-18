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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const customerService = {
    findCustomerEmail: jest.fn(),
    create: jest.fn(),
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
  });

  it('logs in with valid credentials and returns both tokens', async () => {
    customerService.findCustomerEmail.mockResolvedValue(customer);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customer.email, password })
      .expect(200);

    expect(response.body).toEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
    });
  });

  it('rejects a wrong password with 401, not 500', async () => {
    customerService.findCustomerEmail.mockResolvedValue(customer);

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

  it('requires a bearer token on /auth/me', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('returns the customer behind a valid access token', async () => {
    customerService.findCustomerEmail.mockResolvedValue(customer);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: customer.email, password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .expect(200);

    expect(me.body).toMatchObject({ id: customer.id, email: customer.email });
    expect(me.body).not.toHaveProperty('password');
  });
});
