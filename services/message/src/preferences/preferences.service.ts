import { Injectable, Logger } from '@nestjs/common';
import type { ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import { PrismaService } from '../prisma.service';
import type { NotificationPreferenceEntity } from './entities/preference.entity';
import type { UpsertPreferenceDto } from './dto/upsert-preference.dto';

const DEFAULT_CHANNELS = {
  email: true,
  sms: false,
  push: false,
  inApp: true,
};

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    userId: string,
    tenantId: string,
  ): Promise<ApiResponse<NotificationPreferenceEntity[]>> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId, tenantId },
      orderBy: { eventType: 'asc' },
    });

    return { data: preferences as NotificationPreferenceEntity[] };
  }

  async upsert(
    dto: UpsertPreferenceDto,
    user: AuthenticatedUser,
  ): Promise<ApiResponse<NotificationPreferenceEntity>> {
    const { userId, tenantId } = user;
    const { eventType } = dto;

    const data = {
      email: dto.email ?? DEFAULT_CHANNELS.email,
      sms: dto.sms ?? DEFAULT_CHANNELS.sms,
      push: dto.push ?? DEFAULT_CHANNELS.push,
      inApp: dto.inApp ?? DEFAULT_CHANNELS.inApp,
    };

    const preference = await this.prisma.notificationPreference.upsert({
      where: {
        userId_eventType: { userId, eventType },
      },
      create: {
        tenantId,
        userId,
        eventType,
        ...data,
      },
      update: data,
    });

    this.logger.log(
      `Upserted notification preference for user=${userId} eventType=${eventType}`,
    );

    return { data: preference as NotificationPreferenceEntity };
  }

  async getChannelsForEvent(
    userId: string,
    tenantId: string,
    eventType: string,
  ): Promise<{ email: boolean; sms: boolean; push: boolean; inApp: boolean }> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_eventType: { userId, eventType },
      },
    });

    if (!preference) {
      return { ...DEFAULT_CHANNELS };
    }

    return {
      email: preference.email,
      sms: preference.sms,
      push: preference.push,
      inApp: preference.inApp,
    };
  }
}
