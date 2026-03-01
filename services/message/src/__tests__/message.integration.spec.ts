/**
 * Integration test for the Message service.
 *
 * Uses Testcontainers to spin up real PostgreSQL and Mailpit containers.
 * Tests the full flow: create notification → send email → verify in Mailpit API.
 */
import { GenericContainer, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { NotificationChannel, NotificationStatus } from '@aris/shared-types';

let pgContainer: StartedTestContainer;
let mailpitContainer: StartedTestContainer;
let prisma: PrismaClient;
let databaseUrl: string;
let smtpPort: number;
let mailpitApiPort: number;
let mailpitHost: string;

beforeAll(async () => {
  // Start PostgreSQL
  pgContainer = await new GenericContainer('postgres:16-alpine')
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_USER: 'aris',
      POSTGRES_PASSWORD: 'aris',
      POSTGRES_DB: 'aris_test',
    })
    .withWaitStrategy(
      Wait.forLogMessage('database system is ready to accept connections'),
    )
    .start();

  const pgHost = pgContainer.getHost();
  const pgPort = pgContainer.getMappedPort(5432);
  databaseUrl = `postgresql://aris:aris@${pgHost}:${pgPort}/aris_test`;

  // Start Mailpit (SMTP on 1025, API on 8025)
  mailpitContainer = await new GenericContainer('axllent/mailpit:latest')
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forLogMessage('accessible via'))
    .start();

  mailpitHost = mailpitContainer.getHost();
  smtpPort = mailpitContainer.getMappedPort(1025);
  mailpitApiPort = mailpitContainer.getMappedPort(8025);

  // Set env vars
  process.env['DATABASE_URL'] = databaseUrl;
  process.env['SMTP_HOST'] = mailpitHost;
  process.env['SMTP_PORT'] = String(smtpPort);
  process.env['SMTP_SECURE'] = 'false';
  process.env['SMTP_FROM'] = 'noreply@au-aris.org';

  // Push Prisma schema
  const schemaPath = require
    .resolve('@aris/db-schemas/prisma/schema.prisma')
    .replace(/schema\.prisma$/, '');
  execSync(
    `npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`,
    {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    },
  );

  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  await prisma.$connect();

  // Seed a tenant
  await prisma.tenant.create({
    data: {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'African Union - IBAR',
      code: 'AU-IBAR',
      level: 'CONTINENTAL',
      domain: 'au-aris.org',
      config: {},
    },
  });
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await pgContainer?.stop();
  await mailpitContainer?.stop();
}, 30_000);

describe('Message Service Integration', () => {
  it('should create notification in DB and send email via Mailpit', async () => {
    // Dynamically import to use env vars set above
    const { EmailChannel } = await import('../services/channels/email.channel');

    const emailChannel = new EmailChannel();

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        tenantId: '00000000-0000-4000-a000-000000000001',
        userId: '00000000-0000-4000-b000-000000000001',
        channel: 'EMAIL',
        subject: 'Integration Test — Submission Approved',
        body: '<p>Your outbreak report has been approved.</p>',
        metadata: { recordId: 'rec-int-001' },
      },
    });

    expect(notification.id).toBeDefined();
    expect(notification.status).toBe('PENDING');

    // Send via email channel
    const result = await emailChannel.send({
      to: 'steward@ke.au-aris.org',
      subject: 'Integration Test — Submission Approved',
      body: '<p>Your outbreak report has been approved.</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();

    // Update notification status
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Verify via Mailpit API
    const mailpitUrl = `http://${mailpitHost}:${mailpitApiPort}/api/v1/messages`;
    const response = await fetch(mailpitUrl);
    const data = (await response.json()) as {
      messages: Array<{
        Subject: string;
        To: Array<{ Address: string }>;
      }>;
    };

    expect(data.messages.length).toBeGreaterThanOrEqual(1);

    const sent = data.messages.find(
      (m) => m.Subject === 'Integration Test — Submission Approved',
    );
    expect(sent).toBeDefined();
    expect(sent!.To[0].Address).toBe('steward@ke.au-aris.org');

    // Verify notification in DB is now SENT
    const dbNotif = await prisma.notification.findUnique({
      where: { id: notification.id },
    });
    expect(dbNotif!.status).toBe('SENT');
    expect(dbNotif!.sentAt).toBeDefined();
  });

  it('should store in-app notification in DB', async () => {
    const notification = await prisma.notification.create({
      data: {
        tenantId: '00000000-0000-4000-a000-000000000001',
        userId: '00000000-0000-4000-b000-000000000002',
        channel: 'IN_APP',
        subject: 'Quality Gate Failure',
        body: 'Record rec-002 failed COMPLETENESS gate.',
        metadata: { violations: ['COMPLETENESS'] },
      },
    });

    expect(notification.channel).toBe('IN_APP');
    expect(notification.status).toBe('PENDING');
    expect(notification.readAt).toBeNull();

    // Mark as read
    const updated = await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });

    expect(updated.readAt).toBeDefined();

    // Count unread for this user
    const unreadCount = await prisma.notification.count({
      where: {
        userId: '00000000-0000-4000-b000-000000000002',
        tenantId: '00000000-0000-4000-a000-000000000001',
        readAt: null,
      },
    });

    expect(unreadCount).toBe(0);
  });

  it('should list notifications with pagination', async () => {
    // Create 5 notifications
    for (let i = 0; i < 5; i++) {
      await prisma.notification.create({
        data: {
          tenantId: '00000000-0000-4000-a000-000000000001',
          userId: '00000000-0000-4000-b000-000000000003',
          channel: 'IN_APP',
          subject: `Notification ${i + 1}`,
          body: `Body ${i + 1}`,
        },
      });
    }

    // Page 1 of 2
    const page1 = await prisma.notification.findMany({
      where: {
        userId: '00000000-0000-4000-b000-000000000003',
        tenantId: '00000000-0000-4000-a000-000000000001',
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });

    expect(page1).toHaveLength(3);

    const total = await prisma.notification.count({
      where: {
        userId: '00000000-0000-4000-b000-000000000003',
        tenantId: '00000000-0000-4000-a000-000000000001',
      },
    });

    expect(total).toBe(5);
  });
});
