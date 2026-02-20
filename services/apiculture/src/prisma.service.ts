import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Typed Prisma delegates for apiculture domain models.
 * These match the Prisma schema in prisma/schema.prisma.
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

export interface ApiculturePrismaClient {
  apiary: PrismaDelegate;
  honeyProduction: PrismaDelegate;
  colonyHealth: PrismaDelegate;
  beekeeperTraining: PrismaDelegate;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy, ApiculturePrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  // Delegate accessors — cast through the PrismaClient instance.
  // After `prisma generate`, these properties exist natively on PrismaClient.
  get apiary(): PrismaDelegate {
    return (this.client as never)[`apiary`];
  }

  get honeyProduction(): PrismaDelegate {
    return (this.client as never)[`honeyProduction`];
  }

  get colonyHealth(): PrismaDelegate {
    return (this.client as never)[`colonyHealth`];
  }

  get beekeeperTraining(): PrismaDelegate {
    return (this.client as never)[`beekeeperTraining`];
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
