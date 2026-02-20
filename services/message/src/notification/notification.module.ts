import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailChannel } from '../channels/email.channel';
import { SmsChannel } from '../channels/sms.channel';
import { PushChannel } from '../channels/push.channel';
import { InAppChannel } from '../channels/in-app.channel';
import {
  EMAIL_CHANNEL,
  SMS_CHANNEL,
  PUSH_CHANNEL,
  IN_APP_CHANNEL,
} from '../channels/channel.interface';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [
    PrismaService,
    NotificationService,
    { provide: EMAIL_CHANNEL, useClass: EmailChannel },
    { provide: SMS_CHANNEL, useClass: SmsChannel },
    { provide: PUSH_CHANNEL, useClass: PushChannel },
    { provide: IN_APP_CHANNEL, useClass: InAppChannel },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
