import fp from 'fastify-plugin';
import cron from 'node-cron';
import type { FastifyInstance } from 'fastify';
import { DigestService } from '../services/digest.service';
import { NotificationService } from '../services/notification.service';
import { TemplateEngine } from '../services/template-engine';
import { PreferencesService } from '../services/preferences.service';
import { createEmailChannel } from '../services/channels/email-channel.factory';
import { SmsChannel } from '../services/channels/sms.channel';
import { PushChannel } from '../services/channels/push.channel';
import { InAppChannel } from '../services/channels/in-app.channel';

export default fp(
  async (app: FastifyInstance) => {
    const { channel: emailChannel, provider } = await createEmailChannel(app.prisma);
    app.log.info(`Email provider: ${provider}`);
    const smsChannel = new SmsChannel();
    const pushChannel = new PushChannel();
    const inAppChannel = new InAppChannel();

    const notificationService = new NotificationService(app.prisma, app.kafka, {
      email: emailChannel,
      sms: smsChannel,
      push: pushChannel,
      inApp: inAppChannel,
    });
    const preferencesService = new PreferencesService(app.prisma);
    const templateEngine = new TemplateEngine();
    const digestService = new DigestService(app.prisma, notificationService, templateEngine, preferencesService);

    // Decorate app with services so routes and other plugins can use them
    app.decorate('notificationService', notificationService);
    app.decorate('preferencesService', preferencesService);

    // Daily digest cron: weekdays at 08:00 UTC
    const task = cron.schedule('0 8 * * 1-5', () => {
      digestService.sendDailyDigests().catch((err) => {
        app.log.error(`Digest cron failed: ${err}`);
      });
    });

    app.addHook('onClose', () => {
      task.stop();
    });
  },
  { name: 'scheduler', dependencies: ['prisma', 'kafka'] },
);
