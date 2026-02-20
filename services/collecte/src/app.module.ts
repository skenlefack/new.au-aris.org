import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { CampaignModule } from './campaign/campaign.module';
import { SubmissionModule } from './submission/submission.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-collecte-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    CampaignModule,
    SubmissionModule,
    SyncModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
