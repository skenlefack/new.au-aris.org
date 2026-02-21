import {
  Module,
  DynamicModule,
  Controller,
  Get,
  Injectable,
} from '@nestjs/common';
import {
  TerminusModule,
  HealthCheckService,
  HealthCheck,
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckResult,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

// ── Indicator: PostgreSQL ──

@Injectable()
export class PostgresHealthIndicator extends HealthIndicator {
  private prisma: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> } | null = null;

  setPrisma(prisma: { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }): void {
    this.prisma = prisma;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.prisma) {
      return this.getStatus(key, false, { message: 'Prisma not configured' });
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }
}

// ── Indicator: Redis ──

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: { get: (key: string) => Promise<string | null> } | null = null;

  setRedis(redis: { get: (key: string) => Promise<string | null> }): void {
    this.redis = redis;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.redis) {
      return this.getStatus(key, false, { message: 'Redis not configured' });
    }
    try {
      await this.redis.get('health:ping');
      return this.getStatus(key, true);
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }
}

// ── Indicator: Kafka ──

@Injectable()
export class KafkaHealthIndicator extends HealthIndicator {
  private checkFn: (() => Promise<boolean>) | null = null;

  setCheckFn(fn: () => Promise<boolean>): void {
    this.checkFn = fn;
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    if (!this.checkFn) {
      return this.getStatus(key, true, { message: 'No Kafka check configured' });
    }
    try {
      const ok = await this.checkFn();
      return this.getStatus(key, ok);
    } catch (error) {
      return this.getStatus(key, false, {
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }
}

// ── Health Controller ──

export interface HealthModuleOptions {
  serviceName: string;
  diskPath?: string;
  diskThresholdPercent?: number;
  memoryHeapThresholdBytes?: number;
}

export const HEALTH_OPTIONS = 'ARIS_HEALTH_OPTIONS';

@Controller()
class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly postgres: PostgresHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly kafka: KafkaHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.postgres.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.kafka.isHealthy('kafka'),
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.8,
        }),
      () =>
        this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}

// ── Module ──

@Module({})
export class HealthModule {
  static forRoot(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        {
          provide: HEALTH_OPTIONS,
          useValue: options,
        },
        PostgresHealthIndicator,
        RedisHealthIndicator,
        KafkaHealthIndicator,
        DiskHealthIndicator,
        MemoryHealthIndicator,
      ],
      exports: [
        PostgresHealthIndicator,
        RedisHealthIndicator,
        KafkaHealthIndicator,
      ],
    };
  }
}
