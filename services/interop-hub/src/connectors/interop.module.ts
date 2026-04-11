import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InteropController } from './interop.controller';
import { WahisService } from './wahis.service';
import { EmpresService } from './empres.service';
import { FaostatService } from './faostat.service';
import { FishstatjService } from './fishstatj.service';
import { CitesService } from './cites.service';
import { ConnectorService } from './connector.service';
import { InteropConsumer } from './interop.consumer';

@Module({
  controllers: [InteropController],
  providers: [
    PrismaService,
    WahisService,
    EmpresService,
    FaostatService,
    FishstatjService,
    CitesService,
    ConnectorService,
    InteropConsumer,
  ],
  exports: [WahisService, EmpresService, FaostatService, FishstatjService, CitesService, ConnectorService],
})
export class InteropModule {}
