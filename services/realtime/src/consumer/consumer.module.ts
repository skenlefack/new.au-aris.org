import { Module } from '@nestjs/common';
import { RealtimeConsumer } from './realtime.consumer';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  providers: [RealtimeConsumer],
})
export class ConsumerModule {}
