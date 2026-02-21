import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

@Module({
  controllers: [PreferencesController],
  providers: [PrismaService, PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
