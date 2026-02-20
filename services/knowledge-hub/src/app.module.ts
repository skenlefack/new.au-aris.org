import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { PublicationModule } from './publication/publication.module';
import { ELearningModule } from './elearning/elearning.module';
import { FaqModule } from './faq/faq.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-knowledge-hub-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    PublicationModule,
    ELearningModule,
    FaqModule,
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
