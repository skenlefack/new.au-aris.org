// Patch published templates: add parentFilter on species fields for disease→species filtering
// Run inside aris-form-builder container: node /tmp/patch_templates.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.$queryRawUnsafe(
    `SELECT id, name, schema FROM form_builder.form_templates WHERE status = 'PUBLISHED' AND schema::text LIKE '%diseases%' AND schema::text LIKE '%species%'`
  );

  console.log(`Found ${templates.length} templates with disease + species fields`);
  let patched = 0;

  for (const t of templates) {
    const schema = typeof t.schema === 'string' ? JSON.parse(t.schema) : t.schema;

    // Find disease field code
    let diseaseCode = null;
    for (const s of (schema.sections || [])) {
      for (const f of (s.fields || [])) {
        if (f.type === 'master-data-select' && f.properties?.masterDataType === 'diseases') {
          diseaseCode = f.code;
          break;
        }
      }
      if (diseaseCode) break;
    }
    if (!diseaseCode) continue;

    // Patch species, age-group, control-measures, vaccine-types fields in repeaters
    let modified = false;
    for (const s of (schema.sections || [])) {
      for (const f of (s.fields || [])) {
        if (f.type !== 'repeater') continue;
        // Find species code in this repeater (for age-group parent filter)
        const speciesField = (f.properties?.fields || []).find(
          sf => sf.type === 'master-data-select' && sf.properties?.masterDataType === 'species'
        );
        const speciesCode = speciesField?.code;

        for (const sf of (f.properties?.fields || [])) {
          if (sf.type !== 'master-data-select' || sf.properties?.parentFilter) continue;

          const mdt = sf.properties?.masterDataType;
          // species → filter by disease
          if (mdt === 'species' && diseaseCode) {
            sf.properties.parentFilter = { diseaseId: `$${diseaseCode}` };
            modified = true;
          }
          // age-groups → filter by species (within same repeater row)
          if (mdt === 'age-groups' && speciesCode) {
            sf.properties.parentFilter = { speciesId: `$${speciesCode}` };
            modified = true;
          }
        }
      }

      // Also patch non-repeater fields: control-measures, vaccine-types → by disease
      for (const f of (s.fields || [])) {
        if (f.type !== 'master-data-select' || f.properties?.parentFilter) continue;
        const mdt = f.properties?.masterDataType;
        if ((mdt === 'control-measures' || mdt === 'vaccine-types') && diseaseCode) {
          f.properties.parentFilter = { diseaseId: `$${diseaseCode}` };
          modified = true;
        }
      }
    }

    if (!modified) continue;

    // Update in DB
    await prisma.$executeRawUnsafe(
      `UPDATE form_builder.form_templates SET schema = $1::jsonb WHERE id = $2::uuid`,
      JSON.stringify(schema),
      t.id
    );
    console.log(`  OK: ${t.name}`);
    patched++;
  }

  console.log(`Patched ${patched} templates`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
