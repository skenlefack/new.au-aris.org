import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule as AuthMiddlewareModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { NotificationModule } from './notification/notification.module';
import { PreferencesModule } from './preferences/preferences.module';
import { TemplateModule } from './templates/template.module';
import { DigestModule } from './digest/digest.module';
import { ConsumersModule } from './consumers/consumers.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-message-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthMiddlewareModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    NotificationModule,
    PreferencesModule,
    TemplateModule,
    DigestModule,
    ConsumersModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
