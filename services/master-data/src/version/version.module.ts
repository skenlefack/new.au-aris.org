import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';

@Module({
  controllers: [VersionController],
  providers: [PrismaService, VersionService],
  exports: [VersionService],
})
export class VersionModule {}
