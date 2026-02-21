import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificationModule } from '../notification/notification.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { TemplateModule } from '../templates/template.module';
import { DigestService } from './digest.service';

@Module({
  imports: [NotificationModule, PreferencesModule, TemplateModule],
  providers: [PrismaService, DigestService],
  exports: [DigestService],
})
export class DigestModule {}
