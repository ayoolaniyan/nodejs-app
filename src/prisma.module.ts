import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * The single home of PrismaService. Global so that feature modules share one
 * PrismaClient (and one connection pool) instead of each listing it as a
 * provider and getting a client of their own.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
