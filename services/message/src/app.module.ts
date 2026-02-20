import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule as AuthMiddlewareModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { NotificationModule } from './notification/notification.module';
import { ConsumersModule } from './consumers/consumers.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-message-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthMiddlewareModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    NotificationModule,
    ConsumersModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
