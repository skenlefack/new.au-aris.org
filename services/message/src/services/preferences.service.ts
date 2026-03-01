import type { PrismaClient } from '@prisma/client';
import type { ApiResponse } from '@aris/shared-types';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import type { NotificationPreferenceEntity } from '../preferences/entities/preference.entity';

const DEFAULT_CHANNELS = {
  email: true,
  sms: false,
  push: false,
  inApp: true,
};

export class PreferencesService {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(userId: string, tenantId: string): Promise<ApiResponse<NotificationPreferenceEntity[]>> {
    const preferences = await (this.prisma as any).notificationPreference.findMany({
      where: { userId, tenantId },
      orderBy: { eventType: 'asc' },
    });
    return { data: preferences as NotificationPreferenceEntity[] };
  }

  async upsert(
    dto: { eventType: string; email?: boolean; sms?: boolean; push?: boolean; inApp?: boolean },
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

    const preference = await (this.prisma as any).notificationPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: { tenantId, userId, eventType, ...data },
      update: data,
    });

    return { data: preference as NotificationPreferenceEntity };
  }

  async getChannelsForEvent(
    userId: string,
    tenantId: string,
    eventType: string,
  ): Promise<{ email: boolean; sms: boolean; push: boolean; inApp: boolean }> {
    const preference = await (this.prisma as any).notificationPreference.findUnique({
      where: { userId_eventType: { userId, eventType } },
    });
    if (!preference) return { ...DEFAULT_CHANNELS };
    return {
      email: preference.email,
      sms: preference.sms,
      push: preference.push,
      inApp: preference.inApp,
    };
  }
}
