import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { NotificationConsumerService } from './notification-consumer.service';

@Module({
  imports: [NotificationModule],
  providers: [NotificationConsumerService],
})
export class ConsumersModule {}
