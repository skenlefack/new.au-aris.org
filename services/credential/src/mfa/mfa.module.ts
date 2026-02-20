import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';

@Module({
  controllers: [MfaController],
  providers: [PrismaService, MfaService],
  exports: [MfaService],
})
export class MfaModule {}
