import { PrismaClient } from '@prisma/client';
import {
  TENANT_KE,
  USER_KE_ADMIN,
  SPECIES,
  GEO,
  domainId,
  PREFIX,
  MARKET_NAIROBI,
  MARKET_MOMBASA,
  MARKET_KISUMU,
  resolveMasterDataIds,
} from '../../../scripts/seed-constants';

const prisma = new PrismaClient();
const P = PREFIX.TRADE;

export async function seed(): Promise<void> {
  console.log('📦 Seeding trade-sps...\n');

  const { species, geoEntities } = await resolveMasterDataIds(prisma);
  const sp = (code: string) => species.get(code)!;
  const geo = (code: string) => geoEntities.get(code)!;

  // ── Trade Flows (10) ──
  console.log('  🔄 Trade flows...');

  const tradeFlows = [
    // Kenya exports
    { seq: 1, exportCountry: GEO.KENYA, importCountry: GEO.UGANDA, speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Live cattle', flowDirection: 'EXPORT', quantity: 15000, unit: 'HEAD', valueFob: 22500000, currency: 'USD', hsCode: '0102.29', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 2, exportCountry: GEO.KENYA, importCountry: GEO.TANZANIA, speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Processed milk', flowDirection: 'EXPORT', quantity: 8500000, unit: 'L', valueFob: 6800000, currency: 'USD', hsCode: '0401.10', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 3, exportCountry: GEO.KENYA, importCountry: GEO.ETHIOPIA, speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Raw hides and skins', flowDirection: 'EXPORT', quantity: 2500, unit: 'T', valueFob: 3750000, currency: 'USD', hsCode: '4101.20', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    // Kenya imports
    { seq: 4, exportCountry: GEO.UGANDA, importCountry: GEO.KENYA, speciesCode: SPECIES.TILAPIA, commodity: 'Fresh fish (tilapia)', flowDirection: 'IMPORT', quantity: 12000, unit: 'T', valueFob: 18000000, currency: 'USD', hsCode: '0302.71', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 5, exportCountry: GEO.TANZANIA, importCountry: GEO.KENYA, speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Maize (animal feed)', flowDirection: 'IMPORT', quantity: 85000, unit: 'T', valueFob: 25500000, currency: 'USD', hsCode: '1005.90', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 6, exportCountry: GEO.SOMALIA, importCountry: GEO.KENYA, speciesCode: SPECIES.CAMEL, commodity: 'Live camels', flowDirection: 'IMPORT', quantity: 8500, unit: 'HEAD', valueFob: 12750000, currency: 'USD', hsCode: '0106.19', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    // International
    { seq: 7, exportCountry: GEO.KENYA, importCountry: GEO.KENYA, speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Beef cuts (boneless)', flowDirection: 'EXPORT', quantity: 3200, unit: 'T', valueFob: 19200000, currency: 'USD', hsCode: '0201.30', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30'), spsStatus: 'CERTIFIED' },
    { seq: 8, exportCountry: GEO.KENYA, importCountry: GEO.KENYA, speciesCode: SPECIES.CHICKEN, commodity: 'Day-old chicks', flowDirection: 'IMPORT', quantity: 500000, unit: 'HEAD', valueFob: 750000, currency: 'USD', hsCode: '0105.11', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
    { seq: 9, exportCountry: GEO.KENYA, importCountry: GEO.KENYA, speciesCode: SPECIES.NILE_PERCH, commodity: 'Fish fillets (frozen)', flowDirection: 'EXPORT', quantity: 4500, unit: 'T', valueFob: 31500000, currency: 'USD', hsCode: '0304.89', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30'), spsStatus: 'CERTIFIED' },
    { seq: 10, exportCountry: GEO.KENYA, importCountry: GEO.KENYA, speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Veterinary vaccines', flowDirection: 'IMPORT', quantity: 5000000, unit: 'HEAD', valueFob: 2500000, currency: 'USD', hsCode: '3002.30', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-06-30') },
  ];

  for (const tf of tradeFlows) {
    await prisma.tradeFlow.upsert({
      where: { id: domainId(P, tf.seq) },
      update: {},
      create: {
        id: domainId(P, tf.seq),
        tenantId: TENANT_KE,
        exportCountryId: geo(tf.exportCountry),
        importCountryId: geo(tf.importCountry),
        speciesId: sp(tf.speciesCode),
        commodity: tf.commodity,
        flowDirection: tf.flowDirection,
        quantity: tf.quantity,
        unit: tf.unit,
        valueFob: tf.valueFob,
        currency: tf.currency,
        periodStart: tf.periodStart,
        periodEnd: tf.periodEnd,
        hsCode: tf.hsCode,
        spsStatus: tf.spsStatus ?? null,
        dataClassification: 'PARTNER',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${tradeFlows.length} trade flows`);

  // ── SPS Certificates (5) ──
  console.log('  📋 SPS certificates...');

  const spsCerts = [
    { seq: 101, certificateNumber: 'KE-SPS-2025-001', consignmentId: 'CON-2025-001', exporterId: 'Kenya Meat Commission', importerId: 'Dubai Foods LLC', speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Chilled beef', quantity: 25.0, unit: 'T', originCountry: GEO.KENYA, destCountry: GEO.KENYA, inspectionResult: 'PASS', inspectionDate: new Date('2025-03-15'), status: 'ISSUED', validUntil: new Date('2025-06-15') },
    { seq: 102, certificateNumber: 'KE-SPS-2025-002', consignmentId: 'CON-2025-002', exporterId: 'Lake Victoria Fish Processors', importerId: 'Shanghai Seafood Import Co', speciesCode: SPECIES.NILE_PERCH, commodity: 'Frozen fish fillets', quantity: 40.0, unit: 'T', originCountry: GEO.KENYA, destCountry: GEO.KENYA, inspectionResult: 'PASS', inspectionDate: new Date('2025-04-20'), status: 'ISSUED', validUntil: new Date('2025-07-20') },
    { seq: 103, certificateNumber: 'KE-SPS-2025-003', consignmentId: 'CON-2025-003', exporterId: 'Oserian Flowers', importerId: 'Royal FloraHolland', speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Cut flowers (roses)', quantity: 5.0, unit: 'T', originCountry: GEO.KENYA, destCountry: GEO.KENYA, inspectionResult: 'PASS', inspectionDate: new Date('2025-05-10'), status: 'ISSUED', validUntil: new Date('2025-08-10') },
    { seq: 104, certificateNumber: 'KE-SPS-2025-004', consignmentId: 'CON-2025-004', exporterId: 'Nairobi Exporters', importerId: 'Kampala Traders', speciesCode: SPECIES.GOAT, commodity: 'Live goats', quantity: 500.0, unit: 'HEAD', originCountry: GEO.KENYA, destCountry: GEO.UGANDA, inspectionResult: 'CONDITIONAL', inspectionDate: new Date('2025-06-01'), status: 'DRAFT', validUntil: null, remarks: 'Requires additional brucellosis testing before dispatch' },
    { seq: 105, certificateNumber: 'KE-SPS-2025-005', consignmentId: 'CON-2025-005', exporterId: 'Kenya Beef Exports', importerId: 'London Fine Meats', speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Beef quarters', quantity: 15.0, unit: 'T', originCountry: GEO.KENYA, destCountry: GEO.KENYA, inspectionResult: 'PENDING', inspectionDate: new Date('2024-12-10'), status: 'EXPIRED', validUntil: new Date('2025-03-10') },
  ];

  for (const cert of spsCerts) {
    await prisma.spsCertificate.upsert({
      where: { id: domainId(P, cert.seq) },
      update: {},
      create: {
        id: domainId(P, cert.seq),
        tenantId: TENANT_KE,
        certificateNumber: cert.certificateNumber,
        consignmentId: cert.consignmentId,
        exporterId: cert.exporterId,
        importerId: cert.importerId,
        speciesId: sp(cert.speciesCode),
        commodity: cert.commodity,
        quantity: cert.quantity,
        unit: cert.unit,
        originCountryId: geo(cert.originCountry),
        destinationCountryId: geo(cert.destCountry),
        inspectionResult: cert.inspectionResult,
        inspectionDate: cert.inspectionDate,
        certifiedBy: USER_KE_ADMIN,
        certifiedAt: cert.status === 'ISSUED' ? cert.inspectionDate : null,
        status: cert.status,
        validUntil: cert.validUntil,
        remarks: cert.remarks ?? null,
        dataClassification: 'RESTRICTED',
        createdBy: USER_KE_ADMIN,
        updatedBy: USER_KE_ADMIN,
      },
    });
  }
  console.log(`  ✓ ${spsCerts.length} SPS certificates`);

  // ── Market Prices (15): 5 commodities × 3 markets ──
  console.log('  💰 Market prices...');

  const markets = [
    { id: MARKET_NAIROBI, name: 'Nairobi' },
    { id: MARKET_MOMBASA, name: 'Mombasa' },
    { id: MARKET_KISUMU, name: 'Kisumu' },
  ];

  const commodityPrices = [
    { speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Cattle (per head)', unit: 'HEAD', prices: [85000, 82000, 78000], priceType: 'WHOLESALE', currency: 'KES' },
    { speciesCode: SPECIES.GOAT, commodity: 'Goats (per head)', unit: 'HEAD', prices: [8500, 8200, 7800], priceType: 'WHOLESALE', currency: 'KES' },
    { speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Fresh milk (per litre)', unit: 'L', prices: [65, 70, 60], priceType: 'RETAIL', currency: 'KES' },
    { speciesCode: SPECIES.CHICKEN, commodity: 'Eggs (per tray of 30)', unit: 'HEAD', prices: [450, 480, 420], priceType: 'RETAIL', currency: 'KES' },
    { speciesCode: SPECIES.CATTLE_ZEBU, commodity: 'Maize (per 90kg bag)', unit: 'T', prices: [4200, 4500, 3900], priceType: 'WHOLESALE', currency: 'KES' },
  ];

  let mpSeq = 201;
  for (const cp of commodityPrices) {
    for (let m = 0; m < markets.length; m++) {
      await prisma.marketPrice.upsert({
        where: { id: domainId(P, mpSeq) },
        update: {},
        create: {
          id: domainId(P, mpSeq),
          tenantId: TENANT_KE,
          marketId: markets[m].id,
          speciesId: sp(cp.speciesCode),
          commodity: cp.commodity,
          priceType: cp.priceType,
          price: cp.prices[m],
          currency: cp.currency,
          unit: cp.unit,
          date: new Date('2025-09-01'),
          source: 'KNBS',
          dataClassification: 'PARTNER',
          createdBy: USER_KE_ADMIN,
          updatedBy: USER_KE_ADMIN,
        },
      });
      mpSeq++;
    }
  }
  console.log(`  ✓ 15 market prices`);

  console.log('\n✅ trade-sps seed complete!');
}

async function main(): Promise<void> {
  await seed();
}

main()
  .catch((error) => {
    console.error('❌ trade-sps seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
