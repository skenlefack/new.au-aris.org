import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { AuditService } from './audit.service';
import { InventoryModule } from './inventory/inventory.module';
import { ProtectedAreaModule } from './protected-area/protected-area.module';
import { CitesPermitModule } from './cites-permit/cites-permit.module';
import { CrimeModule } from './crime/crime.module';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-wildlife-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    InventoryModule,
    ProtectedAreaModule,
    CitesPermitModule,
    CrimeModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}
