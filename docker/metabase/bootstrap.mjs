/**
 * ARIS — Metabase Auto-Bootstrap
 *
 * Run after Metabase container starts to:
 * 1. Wait for Metabase to be healthy
 * 2. Complete initial setup if needed (admin user + ARIS database connection)
 * 3. Idempotent — safe to run multiple times
 *
 * Usage: node docker/metabase/bootstrap.mjs
 */

const METABASE_URL = process.env.METABASE_INTERNAL_URL ?? 'http://localhost:3035';
const ADMIN_EMAIL = process.env.METABASE_ADMIN_EMAIL ?? 'admin@au-aris.org';
const ADMIN_PASSWORD = process.env.METABASE_ADMIN_PASSWORD ?? 'ArisMetabase2024!';
const DB_HOST = process.env.POSTGRES_HOST ?? 'postgres';
const DB_PORT = parseInt(process.env.POSTGRES_PORT ?? '5432', 10);
const DB_NAME = process.env.POSTGRES_DB ?? 'aris';
const DB_USER = 'aris_bi_reader';
const DB_PASS = 'BiReader2024!';

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 5000;

async function waitForMetabase() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${METABASE_URL}/api/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.status === 'ok') {
          console.log('Metabase is healthy.');
          return;
        }
      }
    } catch {
      // Not ready yet
    }
    console.log(`Waiting for Metabase... (${i + 1}/${MAX_RETRIES})`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  throw new Error('Metabase did not become healthy in time.');
}

async function getSetupToken() {
  const res = await fetch(`${METABASE_URL}/api/session/properties`);
  if (!res.ok) return null;
  const props = await res.json();
  return props['setup-token'] ?? null;
}

async function runSetup(setupToken) {
  console.log('Running initial Metabase setup...');

  const payload = {
    token: setupToken,
    prefs: {
      site_name: 'ARIS BI Analytics',
      site_locale: 'en',
      allow_tracking: false,
    },
    user: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      first_name: 'ARIS',
      last_name: 'Admin',
      site_name: 'ARIS BI Analytics',
    },
    database: {
      engine: 'postgres',
      name: 'ARIS',
      details: {
        host: DB_HOST,
        port: DB_PORT,
        dbname: DB_NAME,
        user: DB_USER,
        password: DB_PASS,
        ssl: false,
        'tunnel-enabled': false,
      },
      is_full_sync: true,
      is_on_demand: false,
    },
  };

  const res = await fetch(`${METABASE_URL}/api/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    // If setup already done, that's fine
    if (text.includes('already been setup') || text.includes('has already been initialized')) {
      console.log('Metabase was already set up.');
      return;
    }
    throw new Error(`Metabase setup failed: ${res.status} ${text}`);
  }

  console.log('Metabase setup completed successfully.');
}

async function login() {
  const res = await fetch(`${METABASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const body = await res.json();
  return body.id;
}

async function ensureDatabase(sessionId) {
  // Check if ARIS database already exists
  const res = await fetch(`${METABASE_URL}/api/database`, {
    headers: { 'X-Metabase-Session': sessionId },
  });
  if (!res.ok) return;
  const body = await res.json();
  const databases = body.data ?? body;
  const exists = Array.isArray(databases) && databases.some((d) => d.name === 'ARIS');
  if (exists) {
    console.log('ARIS database already registered in Metabase.');
    return;
  }

  // Add ARIS database
  const addRes = await fetch(`${METABASE_URL}/api/database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionId },
    body: JSON.stringify({
      engine: 'postgres',
      name: 'ARIS',
      details: { host: DB_HOST, port: DB_PORT, dbname: DB_NAME, user: DB_USER, password: DB_PASS, ssl: false },
      is_full_sync: true,
    }),
  });
  if (addRes.ok) {
    console.log('ARIS database added to Metabase.');
  } else {
    console.warn('Failed to add ARIS database:', await addRes.text());
  }
}

// Dashboard definitions for signed embedding
const EMBED_DASHBOARDS = [
  { name: 'Continental Overview', description: 'High-level metrics across AU Member States' },
  { name: 'Animal Health', description: 'Outbreak and surveillance summaries' },
  { name: 'Trade & Production', description: 'Trade flow summaries and production trends' },
];

async function ensureDashboards(sessionId) {
  // List existing dashboards
  const res = await fetch(`${METABASE_URL}/api/dashboard`, {
    headers: { 'X-Metabase-Session': sessionId },
  });
  if (!res.ok) return;
  const existing = await res.json();
  const existingNames = new Set((Array.isArray(existing) ? existing : []).map((d) => d.name));

  for (const dash of EMBED_DASHBOARDS) {
    if (existingNames.has(dash.name)) {
      console.log(`Dashboard "${dash.name}" already exists.`);
      continue;
    }

    // Create dashboard
    const createRes = await fetch(`${METABASE_URL}/api/dashboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionId },
      body: JSON.stringify({ name: dash.name, description: dash.description }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      console.log(`Dashboard "${dash.name}" created (id=${created.id}).`);

      // Enable embedding with tenant_id locked
      await fetch(`${METABASE_URL}/api/dashboard/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Metabase-Session': sessionId },
        body: JSON.stringify({
          enable_embedding: true,
          embedding_params: { tenant_id: 'locked' },
        }),
      });
      console.log(`  Embedding enabled for dashboard ${created.id}.`);
    } else {
      console.warn(`Failed to create dashboard "${dash.name}":`, await createRes.text());
    }
  }
}

async function main() {
  try {
    await waitForMetabase();

    const setupToken = await getSetupToken();
    if (setupToken) {
      await runSetup(setupToken);
    } else {
      console.log('Metabase already initialized (no setup token).');
    }

    // Post-setup: ensure database + dashboards with embedding
    try {
      const sessionId = await login();
      await ensureDatabase(sessionId);
      await ensureDashboards(sessionId);
    } catch (err) {
      console.warn('Post-setup tasks failed (non-fatal):', err.message);
    }

    console.log('Metabase bootstrap done.');
  } catch (err) {
    console.error('Metabase bootstrap error:', err.message);
    // Non-fatal: don't crash the process
    process.exit(0);
  }
}

main();
