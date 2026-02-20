import { Module, Global } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EngineService } from './engine.service';

@Global()
@Module({
  providers: [PrismaService, EngineService],
  exports: [EngineService],
})
export class EngineModule {}
