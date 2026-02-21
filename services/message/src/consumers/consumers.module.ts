import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { TemplateModule } from '../templates/template.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { NotificationConsumerService } from './notification-consumer.service';

@Module({
  imports: [NotificationModule, TemplateModule, PreferencesModule],
  providers: [NotificationConsumerService],
})
export class ConsumersModule {}
