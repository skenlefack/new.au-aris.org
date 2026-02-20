import { PrismaClient } from '@prisma/client';
import { SEED_CAMPAIGN } from './seed-data';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    console.log('Connected to database');

    // Upsert campaign
    const campaign = await prisma.campaign.upsert({
      where: { id: '00000000-0000-0000-0000-000000000500' },
      update: {
        name: SEED_CAMPAIGN.name,
        status: SEED_CAMPAIGN.status,
        targetSubmissions: SEED_CAMPAIGN.targetSubmissions,
        description: SEED_CAMPAIGN.description,
      },
      create: {
        id: '00000000-0000-0000-0000-000000000500',
        ...SEED_CAMPAIGN,
      },
    });

    console.log(`Campaign seeded: ${campaign.name} (${campaign.id})`);
    console.log(`  Domain: ${campaign.domain}`);
    console.log(`  Status: ${campaign.status}`);
    console.log(`  Template: ${campaign.templateId}`);
    console.log(`  Zones: ${campaign.targetZones.length}`);
    console.log(`  Agents: ${campaign.assignedAgents.length}`);
    console.log(`  Target: ${campaign.targetSubmissions} submissions`);
    console.log(`  Period: ${campaign.startDate.toISOString().split('T')[0]} → ${campaign.endDate.toISOString().split('T')[0]}`);

    console.log('\nSeed completed successfully');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
