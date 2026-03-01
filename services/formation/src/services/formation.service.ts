import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { StandaloneKafkaProducer } from '@aris/kafka-client';
import type { KafkaHeaders } from '@aris/shared-types';
import {
  TOPIC_SYS_FORMATION_SESSION_CREATED,
  TOPIC_SYS_FORMATION_SESSION_UPDATED,
  TOPIC_SYS_FORMATION_PARTICIPANT_ENROLLED,
  TOPIC_SYS_FORMATION_CERTIFICATION_ISSUED,
} from '@aris/shared-types';

const SERVICE_NAME = 'formation-service';
const CACHE_TTL = 300; // 5 min

class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export interface CreateSessionDto {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  maxParticipants?: number;
  category?: string;
  tags?: string[];
}

export interface UpdateSessionDto {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  maxParticipants?: number;
  category?: string;
  status?: string;
  tags?: string[];
}

export interface ListQuery {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  sort?: string;
  order?: string;
}

export interface EnrollParticipantDto {
  userId: string;
  role?: string;
}

export interface IssueCertificationDto {
  participantId: string;
  grade?: string;
  notes?: string;
}

export class FormationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly kafka: StandaloneKafkaProducer,
  ) {}

  async createSession(dto: CreateSessionDto, tenantId: string, userId: string) {
    const id = randomUUID();
    const session = await (this.prisma as any).formationSession.create({
      data: {
        id,
        tenantId,
        title: dto.title,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        location: dto.location ?? null,
        maxParticipants: dto.maxParticipants ?? null,
        category: dto.category ?? null,
        tags: dto.tags ?? [],
        status: 'DRAFT',
        createdBy: userId,
      },
    });

    await this.invalidateListCache(tenantId);
    await this.publishEvent(TOPIC_SYS_FORMATION_SESSION_CREATED, id, session, tenantId, userId);
    return { data: session };
  }

  async listSessions(tenantId: string, query: ListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const orderBy = { [query.sort ?? 'createdAt']: query.order ?? 'desc' };

    const where: any = { tenantId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const cacheKey = `aris:formation:sessions:${tenantId}:${JSON.stringify({ ...query, page, limit })}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [data, total] = await Promise.all([
      (this.prisma as any).formationSession.findMany({ where, skip, take: limit, orderBy }),
      (this.prisma as any).formationSession.count({ where }),
    ]);

    const result = { data, meta: { total, page, limit } };
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    return result;
  }

  async getSession(id: string, tenantId: string) {
    const cacheKey = `aris:formation:session:${id}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return { data: JSON.parse(cached) };

    const session = await (this.prisma as any).formationSession.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { participants: true },
    });
    if (!session) throw new HttpError(404, 'Training session not found');

    await this.redis.set(cacheKey, JSON.stringify(session), 'EX', CACHE_TTL);
    return { data: session };
  }

  async updateSession(id: string, dto: UpdateSessionDto, tenantId: string, userId: string) {
    const existing = await (this.prisma as any).formationSession.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'Training session not found');

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    if (dto.location !== undefined) updateData.location = dto.location;
    if (dto.maxParticipants !== undefined) updateData.maxParticipants = dto.maxParticipants;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.tags !== undefined) updateData.tags = dto.tags;

    const session = await (this.prisma as any).formationSession.update({
      where: { id },
      data: updateData,
    });

    await this.redis.del(`aris:formation:session:${id}`);
    await this.invalidateListCache(tenantId);
    await this.publishEvent(TOPIC_SYS_FORMATION_SESSION_UPDATED, id, session, tenantId, userId);
    return { data: session };
  }

  async deleteSession(id: string, tenantId: string, userId: string) {
    const existing = await (this.prisma as any).formationSession.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'Training session not found');

    await (this.prisma as any).formationSession.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.redis.del(`aris:formation:session:${id}`);
    await this.invalidateListCache(tenantId);
    return { data: { message: 'Session deleted' } };
  }

  async enrollParticipant(sessionId: string, dto: EnrollParticipantDto, tenantId: string, userId: string) {
    const session = await (this.prisma as any).formationSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
      include: { participants: true },
    });
    if (!session) throw new HttpError(404, 'Training session not found');

    if (session.maxParticipants && session.participants.length >= session.maxParticipants) {
      throw new HttpError(409, 'Session is full');
    }

    const alreadyEnrolled = session.participants.find((p: any) => p.userId === dto.userId);
    if (alreadyEnrolled) throw new HttpError(409, 'User already enrolled');

    const participant = await (this.prisma as any).formationParticipant.create({
      data: {
        id: randomUUID(),
        sessionId,
        userId: dto.userId,
        role: dto.role ?? 'PARTICIPANT',
        enrolledAt: new Date(),
      },
    });

    await this.redis.del(`aris:formation:session:${sessionId}`);
    await this.publishEvent(TOPIC_SYS_FORMATION_PARTICIPANT_ENROLLED, participant.id, participant, tenantId, userId);
    return { data: participant };
  }

  async listParticipants(sessionId: string, tenantId: string) {
    const session = await (this.prisma as any).formationSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
    });
    if (!session) throw new HttpError(404, 'Training session not found');

    const participants = await (this.prisma as any).formationParticipant.findMany({
      where: { sessionId },
      orderBy: { enrolledAt: 'asc' },
    });
    return { data: participants };
  }

  async issueCertification(sessionId: string, dto: IssueCertificationDto, tenantId: string, userId: string) {
    const session = await (this.prisma as any).formationSession.findFirst({
      where: { id: sessionId, tenantId, deletedAt: null },
    });
    if (!session) throw new HttpError(404, 'Training session not found');

    const participant = await (this.prisma as any).formationParticipant.findFirst({
      where: { id: dto.participantId, sessionId },
    });
    if (!participant) throw new HttpError(404, 'Participant not found in this session');

    const certification = await (this.prisma as any).formationCertification.create({
      data: {
        id: randomUUID(),
        sessionId,
        participantId: dto.participantId,
        grade: dto.grade ?? null,
        notes: dto.notes ?? null,
        issuedAt: new Date(),
        issuedBy: userId,
      },
    });

    await this.publishEvent(TOPIC_SYS_FORMATION_CERTIFICATION_ISSUED, certification.id, certification, tenantId, userId);
    return { data: certification };
  }

  private async invalidateListCache(tenantId: string): Promise<void> {
    const pattern = `aris:formation:sessions:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  private async publishEvent(topic: string, entityId: string, payload: unknown, tenantId: string, userId: string): Promise<void> {
    const headers: KafkaHeaders = {
      correlationId: randomUUID(),
      sourceService: SERVICE_NAME,
      tenantId,
      userId,
      schemaVersion: '1',
      timestamp: new Date().toISOString(),
    };
    try { await this.kafka.send(topic, entityId, payload, headers); } catch {}
  }
}
