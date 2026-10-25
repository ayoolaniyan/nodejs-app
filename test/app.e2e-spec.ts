import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma.service';

/**
 * Boots the real AppModule — global guards, GraphQL, health checks — with
 * PrismaService replaced by an in-memory fake, so the wiring is tested
 * without a database.
 */
describe('App (e2e)', () => {
  let app: INestApplication;

  const prisma = {
    customer: { findUnique: jest.fn() },
    // PrismaHealthIndicator tries the MongoDB ping first and falls back to
    // SELECT 1 when the client reports a SQL provider.
    $runCommandRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.$runCommandRaw.mockRejectedValue(
      new Error('Use the mongodb provider'),
    );
  });

  describe('GET /health', () => {
    it('reports 200 when the database answers', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' } },
      });
    });

    it('reports 503 when the database does not answer', async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('connection lost'));

      await request(app.getHttpServer()).get('/health').expect(503);
    });
  });

  it('runs the global throttler guard on GraphQL without breaking it', async () => {
    // The stock ThrottlerGuard cannot find the request inside a resolver;
    // this would be a 500 rather than an authentication error.
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ customers { id } }' });

    expect(response.body.errors[0].message).toMatch(/unauthorized/i);
  });

  it('rate limits login attempts per client', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'guess' });

    for (let i = 0; i < 10; i++) {
      await attempt().expect(401);
    }
    await attempt().expect(429);
  });
});
