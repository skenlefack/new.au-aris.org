import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InteropController } from './interop.controller';
import { WahisService } from './wahis.service';
import { EmpresService } from './empres.service';
import { FaostatService } from './faostat.service';
import { ConnectorService } from './connector.service';
import { InteropConsumer } from './interop.consumer';

@Module({
  controllers: [InteropController],
  providers: [
    PrismaService,
    WahisService,
    EmpresService,
    FaostatService,
    ConnectorService,
    InteropConsumer,
  ],
  exports: [WahisService, EmpresService, FaostatService, ConnectorService],
})
export class InteropModule {}
