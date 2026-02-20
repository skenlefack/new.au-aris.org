import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule as AuthMiddlewareModule } from '@aris/auth-middleware';
import { GatewayModule } from './gateway/gateway.module';
import { ConsumerModule } from './consumer/consumer.module';
import { PresenceModule } from './presence/presence.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-realtime-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthMiddlewareModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    GatewayModule,
    ConsumerModule,
    PresenceModule,
    HealthModule,
  ],
})
export class AppModule {}
