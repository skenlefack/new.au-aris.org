import { Module } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { CrossDomainService } from './cross-domain.service';
import { CrossDomainController } from './cross-domain.controller';

@Module({
  providers: [RedisService, CrossDomainService],
  controllers: [CrossDomainController],
  exports: [CrossDomainService],
})
export class CrossDomainModule {}
