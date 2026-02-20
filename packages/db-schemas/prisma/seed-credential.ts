import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Aris2024!';

// Tenant IDs from seed-tenant.ts
const TENANT_IDS = {
  AU_IBAR: '00000000-0000-4000-a000-000000000001',
  KENYA: '00000000-0000-4000-a000-000000000101',
  ETHIOPIA: '00000000-0000-4000-a000-000000000102',
  NIGERIA: '00000000-0000-4000-a000-000000000201',
  SENEGAL: '00000000-0000-4000-a000-000000000202',
  SOUTH_AFRICA: '00000000-0000-4000-a000-000000000301',
} as const;

// Deterministic user UUIDs
const USER_IDS = {
  SUPER_ADMIN: '10000000-0000-4000-a000-000000000001',
  KE_ADMIN: '10000000-0000-4000-a000-000000000101',
  ET_ADMIN: '10000000-0000-4000-a000-000000000102',
  NG_ADMIN: '10000000-0000-4000-a000-000000000201',
  SN_ADMIN: '10000000-0000-4000-a000-000000000202',
  ZA_ADMIN: '10000000-0000-4000-a000-000000000301',
} as const;

async function main(): Promise<void> {
  console.log('Seeding credential users...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);

  // SUPER_ADMIN for AU-IBAR
  await prisma.user.upsert({
    where: { id: USER_IDS.SUPER_ADMIN },
    update: {},
    create: {
      id: USER_IDS.SUPER_ADMIN,
      tenantId: TENANT_IDS.AU_IBAR,
      email: 'admin@aris.africa',
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: UserRole.SUPER_ADMIN,
      mfaEnabled: false,
      isActive: true,
    },
  });

  // NATIONAL_ADMIN per pilot Member State
  const nationalAdmins = [
    { id: USER_IDS.KE_ADMIN, tenantId: TENANT_IDS.KENYA, email: 'admin@ke.aris.africa', firstName: 'Kenya', lastName: 'Administrator' },
    { id: USER_IDS.ET_ADMIN, tenantId: TENANT_IDS.ETHIOPIA, email: 'admin@et.aris.africa', firstName: 'Ethiopia', lastName: 'Administrator' },
    { id: USER_IDS.NG_ADMIN, tenantId: TENANT_IDS.NIGERIA, email: 'admin@ng.aris.africa', firstName: 'Nigeria', lastName: 'Administrator' },
    { id: USER_IDS.SN_ADMIN, tenantId: TENANT_IDS.SENEGAL, email: 'admin@sn.aris.africa', firstName: 'Senegal', lastName: 'Administrator' },
    { id: USER_IDS.ZA_ADMIN, tenantId: TENANT_IDS.SOUTH_AFRICA, email: 'admin@za.aris.africa', firstName: 'South Africa', lastName: 'Administrator' },
  ];

  for (const admin of nationalAdmins) {
    await prisma.user.upsert({
      where: { id: admin.id },
      update: {},
      create: {
        id: admin.id,
        tenantId: admin.tenantId,
        email: admin.email,
        passwordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: UserRole.NATIONAL_ADMIN,
        mfaEnabled: false,
        isActive: true,
      },
    });
  }

  console.log('Credential users seeded:');
  console.log('  1 SUPER_ADMIN (AU-IBAR)');
  console.log(`  ${nationalAdmins.length} NATIONAL_ADMINs (pilot MS)`);
  console.log(`  Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
