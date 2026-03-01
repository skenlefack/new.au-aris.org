import type { Server as SocketIOServer } from 'socket.io';
import type { RoomManagerService } from './services/room-manager.service';
import type { PresenceService } from './services/presence.service';
import type { StandaloneKafkaConsumer } from '@aris/kafka-client';
import type { FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
    roomManager: RoomManagerService;
    presenceService: PresenceService;
    kafkaConsumer: StandaloneKafkaConsumer;
    jwtPublicKey: string;
    authHookFn: (request: FastifyRequest, reply: any) => Promise<void>;
  }
}
