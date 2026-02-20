import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Typed Prisma delegates for animal-health domain models.
 * These match the Prisma schema in packages/db-schemas/prisma/animal-health.prisma.
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

export interface AnimalHealthPrismaClient {
  healthEvent: PrismaDelegate;
  labResult: PrismaDelegate;
  surveillanceActivity: PrismaDelegate;
  vaccinationCampaign: PrismaDelegate;
  svCapacity: PrismaDelegate;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy, AnimalHealthPrismaClient {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  // Delegate accessors — cast through the PrismaClient instance.
  // After `prisma generate`, these properties exist natively on PrismaClient.
  get healthEvent(): PrismaDelegate {
    return (this.client as never)[`healthEvent`];
  }

  get labResult(): PrismaDelegate {
    return (this.client as never)[`labResult`];
  }

  get surveillanceActivity(): PrismaDelegate {
    return (this.client as never)[`surveillanceActivity`];
  }

  get vaccinationCampaign(): PrismaDelegate {
    return (this.client as never)[`vaccinationCampaign`];
  }

  get svCapacity(): PrismaDelegate {
    return (this.client as never)[`svCapacity`];
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
