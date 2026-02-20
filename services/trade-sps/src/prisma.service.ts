import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Typed Prisma delegates for trade-sps domain models.
 * These match the Prisma schema in packages/db-schemas/prisma/trade-sps.prisma.
 * Once `prisma generate` runs against the full schema, PrismaClient will
 * natively expose these delegates and this wrapper becomes a simple extends.
 *
 * Return types use `any` at the Prisma boundary — services cast to entity types.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
interface PrismaDelegate {
  create(args: any): Promise<any>;
  findUnique(args: any): Promise<any>;
  findFirst(args: any): Promise<any>;
  findMany(args: any): Promise<any[]>;
  update(args: any): Promise<any>;
  count(args: any): Promise<number>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface TradeSPSPrismaClient {
  tradeFlow: PrismaDelegate;
  spsCertificate: PrismaDelegate;
  marketPrice: PrismaDelegate;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy, TradeSPSPrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  // Delegate accessors — cast through the PrismaClient instance.
  // After `prisma generate`, these properties exist natively on PrismaClient.
  get tradeFlow(): PrismaDelegate {
    return (this.client as never)['tradeFlow'];
  }

  get spsCertificate(): PrismaDelegate {
    return (this.client as never)['spsCertificate'];
  }

  get marketPrice(): PrismaDelegate {
    return (this.client as never)['marketPrice'];
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
