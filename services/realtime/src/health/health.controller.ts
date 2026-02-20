import { Controller, Get } from '@nestjs/common';
import { RoomManagerService } from '../gateway/room-manager.service';
import { PresenceService } from '../presence/presence.service';

@Controller('api/v1/realtime')
export class HealthController {
  constructor(
    private readonly roomManager: RoomManagerService,
    private readonly presenceService: PresenceService,
  ) {}

  @Get('health')
  health(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'realtime',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('stats')
  stats(): {
    data: {
      connectedClients: number;
      activeRooms: number;
      totalMessages: number;
      uptimeSeconds: number;
      messagesPerSecond: number;
      rooms: Array<{ name: string; clientCount: number }>;
      totalOnlineUsers: number;
    };
  } {
    const stats = this.roomManager.getStats();
    const rooms = this.roomManager.getAllRooms();
    const totalOnlineUsers = this.presenceService.getAllOnlineCount();

    return {
      data: {
        ...stats,
        rooms,
        totalOnlineUsers,
      },
    };
  }
}
