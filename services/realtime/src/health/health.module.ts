import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GatewayModule } from '../gateway/gateway.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [GatewayModule, PresenceModule],
  controllers: [HealthController],
})
export class HealthModule {}
