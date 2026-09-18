import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { CustomerService } from 'src/customer/customer.service';

const env: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let customerService: jest.Mocked<
    Pick<CustomerService, 'findCustomerEmail' | 'create'>
  >;

  const storedPassword = 'correct-horse-battery';
  let storedHash: string;

  beforeAll(async () => {
    storedHash = await argon2.hash(storedPassword);
  });

  beforeEach(async () => {
    customerService = {
      findCustomerEmail: jest.fn(),
      create: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: CustomerService, useValue: customerService },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    jwtService = moduleRef.get(JwtService);
  });

  const existingCustomer = {
    id: 'ff1b0c1e-0000-4000-8000-000000000001',
    email: 'customer@example.com',
    password: '',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('login', () => {
    it('issues tokens whose subject is the customer id, never the password hash', async () => {
      customerService.findCustomerEmail.mockResolvedValue({
        ...existingCustomer,
        password: storedHash,
      } as never);

      const tokens = await authService.login({
        email: existingCustomer.email,
        password: storedPassword,
      } as never);

      const claims = jwtService.decode(tokens.access_token) as Record<
        string,
        unknown
      >;

      expect(claims.sub).toBe(existingCustomer.id);
      // A JWT payload is base64, not encryption: anything placed here is
      // readable by whoever holds the token.
      expect(JSON.stringify(claims)).not.toContain(storedHash);
      expect(JSON.stringify(claims)).not.toContain(storedPassword);
    });

    it('signs the refresh token with a different secret than the access token', async () => {
      customerService.findCustomerEmail.mockResolvedValue({
        ...existingCustomer,
        password: storedHash,
      } as never);

      const tokens = await authService.login({
        email: existingCustomer.email,
        password: storedPassword,
      } as never);

      expect(() =>
        jwtService.verify(tokens.refresh_token, { secret: env.JWT_SECRET }),
      ).toThrow();
      expect(
        jwtService.verify(tokens.refresh_token, {
          secret: env.JWT_REFRESH_SECRET,
        }),
      ).toMatchObject({ sub: existingCustomer.id });
    });

    it('rejects a wrong password', async () => {
      customerService.findCustomerEmail.mockResolvedValue({
        ...existingCustomer,
        password: storedHash,
      } as never);

      await expect(
        authService.login({
          email: existingCustomer.email,
          password: 'not-the-password',
        } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      customerService.findCustomerEmail.mockResolvedValue(null as never);

      await expect(
        authService.login({
          email: 'nobody@example.com',
          password: storedPassword,
        } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signup', () => {
    it('stores a hash rather than the password itself', async () => {
      customerService.findCustomerEmail.mockResolvedValue(null as never);
      customerService.create.mockImplementation(
        (async (data: Record<string, unknown>) => ({
          ...existingCustomer,
          ...data,
        })) as never,
      );

      await authService.signup({
        email: 'new@example.com',
        password: storedPassword,
      } as never);

      const [created] = customerService.create.mock.calls[0];
      expect(created.password).not.toBe(storedPassword);
      expect(await argon2.verify(created.password, storedPassword)).toBe(true);
    });

    it('refuses an email that is already registered', async () => {
      customerService.findCustomerEmail.mockResolvedValue(
        existingCustomer as never,
      );

      await expect(
        authService.signup({
          email: existingCustomer.email,
          password: storedPassword,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(customerService.create).not.toHaveBeenCalled();
    });
  });

  describe('validateCustomer', () => {
    it('never returns the password hash', async () => {
      customerService.findCustomerEmail.mockResolvedValue({
        ...existingCustomer,
        password: storedHash,
      } as never);

      const customer = await authService.validateCustomer({
        email: existingCustomer.email,
      });

      expect(customer).not.toHaveProperty('password');
      expect(customer).toMatchObject({ id: existingCustomer.id });
    });
  });
});
