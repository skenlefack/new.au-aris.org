import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PublicationController } from './publication.controller';
import { PublicationService } from './publication.service';

@Module({
  controllers: [PublicationController],
  providers: [PrismaService, PublicationService],
  exports: [PublicationService],
})
export class PublicationModule {}
