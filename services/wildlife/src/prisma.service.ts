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

export interface WildlifePrismaClient {
  wildlifeInventory: PrismaDelegate;
  protectedArea: PrismaDelegate;
  citesPermit: PrismaDelegate;
  wildlifeCrime: PrismaDelegate;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy, WildlifePrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  get wildlifeInventory(): PrismaDelegate {
    return (this.client as never)[`wildlifeInventory`];
  }

  get protectedArea(): PrismaDelegate {
    return (this.client as never)[`protectedArea`];
  }

  get citesPermit(): PrismaDelegate {
    return (this.client as never)[`citesPermit`];
  }

  get wildlifeCrime(): PrismaDelegate {
    return (this.client as never)[`wildlifeCrime`];
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
