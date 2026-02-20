import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit.service';
import { SpsCertificateController } from './sps-certificate.controller';
import { SpsCertificateService } from './sps-certificate.service';

@Module({
  controllers: [SpsCertificateController],
  providers: [PrismaService, AuditService, SpsCertificateService],
  exports: [SpsCertificateService],
})
export class SpsCertificateModule {}
