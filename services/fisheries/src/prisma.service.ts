import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

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

export interface FisheriesPrismaClient {
  fishCapture: PrismaDelegate;
  fishingVessel: PrismaDelegate;
  aquacultureFarm: PrismaDelegate;
  aquacultureProduction: PrismaDelegate;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy, FisheriesPrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  get fishCapture(): PrismaDelegate {
    return (this.client as never)[`fishCapture`];
  }

  get fishingVessel(): PrismaDelegate {
    return (this.client as never)[`fishingVessel`];
  }

  get aquacultureFarm(): PrismaDelegate {
    return (this.client as never)[`aquacultureFarm`];
  }

  get aquacultureProduction(): PrismaDelegate {
    return (this.client as never)[`aquacultureProduction`];
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
