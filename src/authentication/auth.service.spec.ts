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
    Pick<
      CustomerService,
      | 'findCustomerEmail'
      | 'findById'
      | 'findAuthRecordById'
      | 'create'
      | 'setRefreshTokenHash'
    >
  >;

  const storedPassword = 'correct-horse-battery';
  let storedHash: string;

  beforeAll(async () => {
    storedHash = await argon2.hash(storedPassword);
  });

  beforeEach(async () => {
    customerService = {
      findCustomerEmail: jest.fn(),
      findById: jest.fn(),
      findAuthRecordById: jest.fn(),
      create: jest.fn(),
      setRefreshTokenHash: jest.fn(),
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
    refreshTokenHash: null as string | null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function loginAsExistingCustomer() {
    customerService.findCustomerEmail.mockResolvedValue({
      ...existingCustomer,
      password: storedHash,
    } as never);

    return authService.login({
      email: existingCustomer.email,
      password: storedPassword,
    } as never);
  }

  /** The refresh token hash most recently passed to setRefreshTokenHash. */
  function lastStoredRefreshHash(): string | null {
    const calls = customerService.setRefreshTokenHash.mock.calls;
    return calls[calls.length - 1][1];
  }

  describe('login', () => {
    it('issues tokens whose subject is the customer id, never the password hash', async () => {
      const tokens = await loginAsExistingCustomer();

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
      const tokens = await loginAsExistingCustomer();

      expect(() =>
        jwtService.verify(tokens.refresh_token, { secret: env.JWT_SECRET }),
      ).toThrow();
      expect(
        jwtService.verify(tokens.refresh_token, {
          secret: env.JWT_REFRESH_SECRET,
        }),
      ).toMatchObject({ sub: existingCustomer.id });
    });

    it('stores a hash of the refresh token rather than the token itself', async () => {
      const tokens = await loginAsExistingCustomer();

      const stored = lastStoredRefreshHash();
      expect(customerService.setRefreshTokenHash).toHaveBeenCalledWith(
        existingCustomer.id,
        expect.any(String),
      );
      expect(stored).not.toBe(tokens.refresh_token);
      expect(await argon2.verify(stored, tokens.refresh_token)).toBe(true);
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

    it('spends the same argon2 work on an unknown email as on a wrong password', async () => {
      // Returning before argon2 would make misses measurably faster, and
      // response time alone would reveal which emails are registered.
      const verify = jest.spyOn(argon2, 'verify');
      customerService.findCustomerEmail.mockResolvedValue(null as never);

      await expect(
        authService.login({
          email: 'nobody@example.com',
          password: storedPassword,
        } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(verify).toHaveBeenCalledTimes(1);
      verify.mockRestore();
    });
  });

  describe('signup', () => {
    it('stores a hash rather than the password itself', async () => {
      customerService.findCustomerEmail.mockResolvedValue(null as never);
      customerService.create.mockImplementation((async (
        data: Record<string, unknown>,
      ) => ({
        ...existingCustomer,
        ...data,
      })) as never);

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

  describe('refreshTokens', () => {
    it('exchanges the current refresh token for a new pair and rotates it', async () => {
      const first = await loginAsExistingCustomer();
      customerService.findAuthRecordById.mockResolvedValue({
        ...existingCustomer,
        refreshTokenHash: lastStoredRefreshHash(),
      } as never);

      const second = await authService.refreshTokens(
        existingCustomer.id,
        first.refresh_token,
      );

      expect(second.refresh_token).not.toBe(first.refresh_token);
      const rotated = lastStoredRefreshHash();
      expect(await argon2.verify(rotated, second.refresh_token)).toBe(true);
      expect(await argon2.verify(rotated, first.refresh_token)).toBe(false);
    });

    it('rejects a refresh token that has already been rotated away', async () => {
      const first = await loginAsExistingCustomer();
      await loginAsExistingCustomer();
      customerService.findAuthRecordById.mockResolvedValue({
        ...existingCustomer,
        refreshTokenHash: lastStoredRefreshHash(),
      } as never);

      await expect(
        authService.refreshTokens(existingCustomer.id, first.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects any refresh token after logout', async () => {
      const tokens = await loginAsExistingCustomer();
      await authService.logout(existingCustomer.id);
      expect(lastStoredRefreshHash()).toBeNull();
      customerService.findAuthRecordById.mockResolvedValue({
        ...existingCustomer,
        refreshTokenHash: null,
      } as never);

      await expect(
        authService.refreshTokens(existingCustomer.id, tokens.refresh_token),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a refresh token for a customer that no longer exists', async () => {
      customerService.findAuthRecordById.mockResolvedValue(null as never);

      await expect(
        authService.refreshTokens(existingCustomer.id, 'any-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('validateCustomer', () => {
    it('looks the customer up by id, not by the email claim', async () => {
      const { password: _p, refreshTokenHash: _r, ...safe } = existingCustomer;
      customerService.findById.mockResolvedValue(safe as never);

      const customer = await authService.validateCustomer(existingCustomer.id);

      expect(customerService.findById).toHaveBeenCalledWith(
        existingCustomer.id,
      );
      expect(customerService.findCustomerEmail).not.toHaveBeenCalled();
      expect(customer).toMatchObject({ id: existingCustomer.id });
    });
  });
});
