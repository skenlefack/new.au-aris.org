import type { PrismaClient } from '@prisma/client';
import type { MessageChannel, NotificationPayload, ChannelResult } from '../channel.interface';
import { EmailChannel } from './email.channel';
import { PostmarkChannel } from './postmark.channel';

interface DbConfigRow {
  key: string;
  value: unknown;
}

/**
 * Load email settings from governance.system_configs (set via General
 * Settings > Email Delivery). Falls back to environment variables if the
 * DB is unavailable or a given key is missing.
 */
async function loadDbEmailConfig(prisma: PrismaClient): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  try {
    const rows: DbConfigRow[] = await (prisma as any).$queryRawUnsafe(
      `SELECT key, value FROM governance.system_configs WHERE LOWER(category) = 'email'`,
    );
    for (const row of rows) {
      const v = typeof row.value === 'string' ? row.value
        : row.value != null ? String(row.value)
        : '';
      config[row.key] = v;
    }
  } catch {
    // DB not reachable or table doesn't exist yet — env vars will be used
  }
  return config;
}

function buildChannel(db: Record<string, string>): { channel: MessageChannel; provider: string } {
  const provider = (
    db['email.provider'] || process.env['EMAIL_PROVIDER'] || 'smtp'
  ).toLowerCase();

  switch (provider) {
    case 'postmark':
      return {
        channel: new PostmarkChannel({
          serverToken: db['email.postmark.serverToken'] || undefined,
          from: db['email.postmark.from'] || undefined,
          messageStream: db['email.postmark.messageStream'] || undefined,
          tag: db['email.postmark.tag'] || undefined,
        }),
        provider: 'postmark',
      };

    case 'smtp':
      return {
        channel: new EmailChannel({
          host: db['email.smtp.host'] || undefined,
          port: db['email.smtp.port'] ? Number(db['email.smtp.port']) : undefined,
          from: db['email.smtp.from'] || undefined,
          // Pull authentication + TLS flags from the same DB category so
          // the General Settings UI can drive them without a redeploy.
          secure: db['email.smtp.secure'] ? db['email.smtp.secure'] === 'true' : undefined,
          user: db['email.smtp.user'] || undefined,
          pass: db['email.smtp.pass'] || undefined,
        }),
        provider: 'smtp',
      };

    default:
      console.warn(
        `Unknown EMAIL_PROVIDER="${provider}", falling back to SMTP. Valid values: smtp, postmark`,
      );
      return { channel: new EmailChannel(), provider: 'smtp (fallback)' };
  }
}

/**
 * MessageChannel wrapper that re-reads the email DB config on each send
 * (with a short in-memory cache) so admins can change
 * General Settings > Email Delivery without restarting the service.
 * A provider change or credentials update takes effect within CACHE_TTL.
 */
export class DynamicEmailChannel implements MessageChannel {
  private cached: { channel: MessageChannel; provider: string; expiresAt: number } | null = null;
  private readonly cacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaClient | undefined,
    cacheTtlMs = 30_000,
  ) {
    this.cacheTtlMs = cacheTtlMs;
  }

  async getChannel(): Promise<{ channel: MessageChannel; provider: string }> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) {
      return { channel: this.cached.channel, provider: this.cached.provider };
    }
    const db = this.prisma ? await loadDbEmailConfig(this.prisma) : {};
    const built = buildChannel(db);
    this.cached = { ...built, expiresAt: now + this.cacheTtlMs };
    return built;
  }

  /** Force the next send to re-read DB config immediately. */
  invalidate(): void {
    this.cached = null;
  }

  async send(payload: NotificationPayload): Promise<ChannelResult> {
    try {
      const { channel, provider } = await this.getChannel();
      const result = await channel.send(payload);
      if (!result.success) {
        console.error(
          `[DynamicEmailChannel] ${provider} failed to send to ${payload.to}: ${result.error}`,
        );
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[DynamicEmailChannel] Unable to build email channel: ${message}`);
      return { success: false, error: message };
    }
  }
}

/**
 * Legacy factory kept for backward compatibility. Prefer the
 * DynamicEmailChannel wrapper above so admin changes propagate without a
 * redeploy. The returned channel is now a DynamicEmailChannel that still
 * exposes the originally-resolved provider string for startup logging.
 */
export async function createEmailChannel(
  prisma?: PrismaClient,
): Promise<{ channel: MessageChannel; provider: string }> {
  const dynamic = new DynamicEmailChannel(prisma);
  const { provider } = await dynamic.getChannel(); // warm up + resolve provider label
  return { channel: dynamic, provider };
}
