import { Module } from '@nestjs/common';
import { KafkaModule } from '@aris/kafka-client';
import { AuthModule } from '@aris/auth-middleware';
import { PrismaService } from './prisma.service';
import { GeoModule } from './geo/geo.module';
import { SpeciesModule } from './species/species.module';
import { DiseaseModule } from './disease/disease.module';
import { UnitModule } from './unit/unit.module';
import { TemporalityModule } from './temporality/temporality.module';
import { IdentifierModule } from './identifier/identifier.module';
import { DenominatorModule } from './denominator/denominator.module';
import { VersionModule } from './version/version.module';
import { ImportExportModule } from './import-export/import-export.module';
import { HistoryModule } from './history/history.module';
import { AuditService } from './audit/audit.service';

@Module({
  imports: [
    KafkaModule.forRoot({
      clientId: process.env['KAFKA_CLIENT_ID'] ?? 'aris-master-data-service',
      brokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    }),
    AuthModule.forRoot({
      publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
    }),
    GeoModule,
    SpeciesModule,
    DiseaseModule,
    UnitModule,
    TemporalityModule,
    IdentifierModule,
    DenominatorModule,
    VersionModule,
    ImportExportModule,
    HistoryModule,
  ],
  providers: [PrismaService, AuditService],
  exports: [PrismaService, AuditService],
})
export class AppModule {}
