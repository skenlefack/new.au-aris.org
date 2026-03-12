import type { PrismaClient } from '@prisma/client';
import type { MessageChannel } from '../channel.interface';
import { EmailChannel } from './email.channel';
import { PostmarkChannel } from './postmark.channel';

interface DbConfigRow {
  key: string;
  value: unknown;
}

/**
 * Loads email settings from the governance.system_configs table (set via General Settings UI),
 * falling back to environment variables if the DB is unavailable or empty.
 */
async function loadDbEmailConfig(prisma: PrismaClient): Promise<Record<string, string>> {
  const config: Record<string, string> = {};
  try {
    const rows: DbConfigRow[] = await (prisma as any).$queryRawUnsafe(
      `SELECT key, value FROM governance.system_configs WHERE LOWER(category) = 'email'`,
    );
    for (const row of rows) {
      // value is stored as JSON — unwrap primitive strings/numbers
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

export async function createEmailChannel(
  prisma?: PrismaClient,
): Promise<{ channel: MessageChannel; provider: string }> {
  const db = prisma ? await loadDbEmailConfig(prisma) : {};

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
