import { Module, forwardRef } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RoomManagerService } from './room-manager.service';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [forwardRef(() => PresenceModule)],
  providers: [RealtimeGateway, RoomManagerService],
  exports: [RealtimeGateway, RoomManagerService],
})
export class GatewayModule {}
