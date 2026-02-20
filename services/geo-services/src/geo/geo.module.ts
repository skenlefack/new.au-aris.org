import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../redis.service';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  controllers: [GeoController],
  providers: [PrismaService, RedisService, GeoService],
  exports: [GeoService],
})
export class GeoModule {}
