/**
 * ARIS 4.0 — Elasticsearch → OpenSearch Data Migration Script
 *
 * Reads all indices from an Elasticsearch 8.x instance and writes them
 * into an OpenSearch 2.x instance via the bulk API.
 *
 * Usage:
 *   npx tsx scripts/migrate-es-to-opensearch.ts
 *
 * Environment variables:
 *   ES_SOURCE_URL     — Source Elasticsearch URL (default: http://localhost:9201)
 *   OPENSEARCH_URL    — Target OpenSearch URL   (default: http://localhost:9200)
 *   OPENSEARCH_USER   — OpenSearch auth user     (optional)
 *   OPENSEARCH_PASSWORD — OpenSearch auth pass   (optional)
 *   BATCH_SIZE        — Documents per bulk batch (default: 500)
 */

import { Client as OpenSearchClient } from '@opensearch-project/opensearch';

const ES_SOURCE_URL = process.env['ES_SOURCE_URL'] ?? 'http://localhost:9201';
const OS_TARGET_URL = process.env['OPENSEARCH_URL'] ?? 'http://localhost:9200';
const BATCH_SIZE = parseInt(process.env['BATCH_SIZE'] ?? '500', 10);

interface IndexInfo {
  index: string;
  'docs.count': string;
  'store.size': string;
}

async function main() {
  console.log('=== ARIS 4.0 — ES → OpenSearch Migration ===\n');

  // Source: old Elasticsearch (use the same client — API-compatible)
  const source = new OpenSearchClient({ node: ES_SOURCE_URL });

  // Target: new OpenSearch
  const target = new OpenSearchClient({
    node: OS_TARGET_URL,
    auth: process.env['OPENSEARCH_USER']
      ? {
          username: process.env['OPENSEARCH_USER']!,
          password: process.env['OPENSEARCH_PASSWORD'] ?? '',
        }
      : undefined,
    ssl: { rejectUnauthorized: false },
  });

  // 1. Verify connectivity
  try {
    const sourceHealth = await source.cluster.health();
    console.log(`Source (ES): ${ES_SOURCE_URL} — status=${sourceHealth.body.status}`);
  } catch (err) {
    console.error(`Cannot connect to source Elasticsearch at ${ES_SOURCE_URL}`);
    console.error('If no existing data to migrate, this is expected. Exiting gracefully.');
    process.exit(0);
  }

  try {
    const targetHealth = await target.cluster.health();
    console.log(`Target (OS): ${OS_TARGET_URL} — status=${targetHealth.body.status}`);
  } catch (err) {
    console.error(`Cannot connect to target OpenSearch at ${OS_TARGET_URL}`);
    process.exit(1);
  }

  // 2. List source indices (exclude system indices)
  const catResponse = await source.cat.indices({ format: 'json' });
  const indices: IndexInfo[] = (catResponse.body as IndexInfo[]).filter(
    (idx) => !idx.index.startsWith('.'),
  );

  if (indices.length === 0) {
    console.log('\nNo user indices found in source. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`\nFound ${indices.length} indices to migrate:`);
  for (const idx of indices) {
    console.log(`  - ${idx.index} (${idx['docs.count']} docs, ${idx['store.size']})`);
  }

  // 3. Migrate each index
  let totalMigrated = 0;
  let totalErrors = 0;

  for (const idx of indices) {
    const indexName = idx.index;
    const expectedCount = parseInt(idx['docs.count'], 10);
    console.log(`\n--- Migrating: ${indexName} (${expectedCount} docs) ---`);

    // Get source index mapping and create in target
    try {
      const mappingResponse = await source.indices.getMapping({ index: indexName });
      const mapping = mappingResponse.body[indexName];

      const targetExists = await target.indices.exists({ index: indexName });
      if (!targetExists.body) {
        await target.indices.create({
          index: indexName,
          body: {
            mappings: mapping.mappings,
          },
        });
        console.log(`  Created index ${indexName} in target`);
      } else {
        console.log(`  Index ${indexName} already exists in target, skipping creation`);
      }
    } catch (err) {
      console.error(`  Failed to create index ${indexName}: ${err}`);
      totalErrors++;
      continue;
    }

    // Scroll through source and bulk-write to target
    let scrollId: string | undefined;
    let batchNum = 0;
    let indexMigrated = 0;

    try {
      // Initial search with scroll
      const scrollResponse = await source.search({
        index: indexName,
        scroll: '5m',
        size: BATCH_SIZE,
        body: { query: { match_all: {} } },
      });

      scrollId = scrollResponse.body._scroll_id;
      let hits = scrollResponse.body.hits.hits;

      while (hits.length > 0) {
        batchNum++;

        // Build bulk operations
        const bulkBody: unknown[] = [];
        for (const hit of hits) {
          bulkBody.push({ index: { _index: indexName, _id: hit._id } });
          bulkBody.push(hit._source);
        }

        const bulkResponse = await target.bulk({ body: bulkBody });
        if (bulkResponse.body.errors) {
          const errorItems = bulkResponse.body.items.filter(
            (item: any) => item.index?.error,
          );
          console.error(`  Batch ${batchNum}: ${errorItems.length} errors`);
          totalErrors += errorItems.length;
        }

        indexMigrated += hits.length;
        process.stdout.write(`  Batch ${batchNum}: ${indexMigrated}/${expectedCount} docs\r`);

        // Next scroll page
        const nextScroll = await source.scroll({
          scroll_id: scrollId!,
          scroll: '5m',
        });
        scrollId = nextScroll.body._scroll_id;
        hits = nextScroll.body.hits.hits;
      }
    } finally {
      // Clean up scroll
      if (scrollId) {
        try {
          await source.clearScroll({ scroll_id: scrollId });
        } catch {}
      }
    }

    console.log(`  Completed: ${indexMigrated} docs migrated`);
    totalMigrated += indexMigrated;

    // 4. Verify counts
    const targetCount = await target.count({ index: indexName });
    const targetDocs = targetCount.body.count;
    if (targetDocs === expectedCount) {
      console.log(`  Verification OK: ${targetDocs}/${expectedCount}`);
    } else {
      console.warn(`  Verification MISMATCH: target=${targetDocs}, source=${expectedCount}`);
    }
  }

  // 5. Summary
  console.log('\n=== Migration Summary ===');
  console.log(`  Indices migrated: ${indices.length}`);
  console.log(`  Documents migrated: ${totalMigrated}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log('=========================\n');

  await source.close();
  await target.close();

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
