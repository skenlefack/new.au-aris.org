/**
 * Simulates exactly what the browser does for PATCH and DELETE requests:
 * 1. Login to get token
 * 2. Test CORS preflight for PATCH & DELETE
 * 3. Send actual PATCH request (with Origin header like browser)
 * 4. Send actual DELETE request (with Origin header like browser)
 * 5. Verify CORS headers on actual (non-preflight) responses
 */
import http from 'http';

function httpReq(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: data
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== Browser Simulation Test for Collecte ===\n');

  // 1. Login
  const loginBody = JSON.stringify({ email: 'admin@au-aris.org', password: 'Aris2024!' });
  const loginRes = await httpReq({
    hostname: 'localhost', port: 3002,
    path: '/api/v1/credential/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) }
  }, loginBody);

  const loginData = JSON.parse(loginRes.body);
  const token = loginData.data?.accessToken;
  if (!token) { console.log('Login failed:', loginRes.body); return; }
  console.log('1. Login OK\n');

  // 2. Create a test campaign first
  const createBody = JSON.stringify({
    name: 'Browser Sim Test Campaign',
    description: 'Test for browser simulation',
    domain: 'animal_health',
    templateId: 'a0000001-0001-4000-8000-000000000001',
    templateIds: ['a0000001-0001-4000-8000-000000000001'],
    targetCountries: ['KE', 'ET'],
    startDate: '2026-04-01T00:00:00.000Z',
    endDate: '2026-07-31T00:00:00.000Z',
    targetSubmissions: 100,
  });

  const createRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createBody),
      'Origin': 'http://localhost:3100',
      'X-Tenant-Id': loginData.data?.user?.tenantId ?? '',
      'X-Locale': 'en',
    }
  }, createBody);

  if (createRes.status !== 201) {
    console.log('Create failed:', createRes.status, createRes.body);
    return;
  }
  const created = JSON.parse(createRes.body);
  const campId = created.data.id;
  console.log('2. Created campaign:', campId);
  console.log('   CORS headers on POST response:');
  console.log('     Access-Control-Allow-Origin:', createRes.headers['access-control-allow-origin'] ?? 'MISSING!');
  console.log('     Access-Control-Allow-Credentials:', createRes.headers['access-control-allow-credentials'] ?? 'MISSING!');
  console.log('     Cross-Origin-Resource-Policy:', createRes.headers['cross-origin-resource-policy'] ?? '(not set - good)');
  console.log('     Cross-Origin-Embedder-Policy:', createRes.headers['cross-origin-embedder-policy'] ?? '(not set - good)');
  console.log();

  // 3. Test PATCH preflight (OPTIONS)
  console.log('3. PATCH preflight (OPTIONS):');
  const patchPreflight = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns/' + campId,
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3100',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'content-type,authorization,x-tenant-id,x-locale',
    }
  });
  console.log('   Status:', patchPreflight.status);
  console.log('   Allow-Origin:', patchPreflight.headers['access-control-allow-origin'] ?? 'MISSING!');
  console.log('   Allow-Methods:', patchPreflight.headers['access-control-allow-methods'] ?? 'MISSING!');
  console.log('   Allow-Headers:', patchPreflight.headers['access-control-allow-headers'] ?? 'MISSING!');
  console.log('   Allow-Credentials:', patchPreflight.headers['access-control-allow-credentials'] ?? 'MISSING!');
  console.log();

  // 4. Actual PATCH request (like browser would send after preflight)
  console.log('4. Actual PATCH request (with browser headers):');
  const patchBody = JSON.stringify({
    name: 'Browser Sim Test Campaign (Updated)',
    description: 'Updated by browser sim test',
    startDate: '2026-04-15T00:00:00.000Z',
    endDate: '2026-08-15T00:00:00.000Z',
    templateIds: ['a0000001-0001-4000-8000-000000000001', 'a0000001-0002-4000-8000-000000000002'],
    targetCountries: ['KE', 'ET', 'UG'],
  });
  const patchRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns/' + campId,
    method: 'PATCH',
    headers: {
      'Origin': 'http://localhost:3100',
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(patchBody),
      'X-Tenant-Id': loginData.data?.user?.tenantId ?? '',
      'X-Locale': 'en',
    }
  }, patchBody);
  console.log('   Status:', patchRes.status);
  console.log('   CORS headers on PATCH response:');
  console.log('     Access-Control-Allow-Origin:', patchRes.headers['access-control-allow-origin'] ?? 'MISSING!');
  console.log('     Access-Control-Allow-Credentials:', patchRes.headers['access-control-allow-credentials'] ?? 'MISSING!');
  console.log('     Cross-Origin-Resource-Policy:', patchRes.headers['cross-origin-resource-policy'] ?? '(not set - good)');
  if (patchRes.status === 200) {
    const data = JSON.parse(patchRes.body);
    console.log('   Updated name:', data.data?.name);
    console.log('   Updated templateIds:', JSON.stringify(data.data?.templateIds));
    console.log('   Updated targetCountries:', JSON.stringify(data.data?.targetCountries));
  } else {
    console.log('   PATCH FAILED! Body:', patchRes.body);
  }
  console.log();

  // 5. Test DELETE preflight (OPTIONS)
  console.log('5. DELETE preflight (OPTIONS):');
  const deletePreflight = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns/' + campId,
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3100',
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'content-type,authorization,x-tenant-id,x-locale',
    }
  });
  console.log('   Status:', deletePreflight.status);
  console.log('   Allow-Origin:', deletePreflight.headers['access-control-allow-origin'] ?? 'MISSING!');
  console.log('   Allow-Methods:', deletePreflight.headers['access-control-allow-methods'] ?? 'MISSING!');
  console.log();

  // 6. Actual DELETE request (like browser would send)
  console.log('6. Actual DELETE request (with browser headers):');
  const deleteRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns/' + campId,
    method: 'DELETE',
    headers: {
      'Origin': 'http://localhost:3100',
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'X-Tenant-Id': loginData.data?.user?.tenantId ?? '',
      'X-Locale': 'en',
    }
  });
  console.log('   Status:', deleteRes.status);
  console.log('   CORS headers on DELETE response:');
  console.log('     Access-Control-Allow-Origin:', deleteRes.headers['access-control-allow-origin'] ?? 'MISSING!');
  console.log('     Access-Control-Allow-Credentials:', deleteRes.headers['access-control-allow-credentials'] ?? 'MISSING!');
  console.log('     Cross-Origin-Resource-Policy:', deleteRes.headers['cross-origin-resource-policy'] ?? '(not set - good)');
  if (deleteRes.status === 200) {
    console.log('   Delete response:', deleteRes.body);
  } else {
    console.log('   DELETE FAILED! Body:', deleteRes.body);
  }
  console.log();

  // 7. Create a fresh campaign for UI testing
  console.log('7. Creating fresh campaign for UI testing...');
  const freshBody = JSON.stringify({
    name: 'FMD Surveillance Q1 2026',
    description: 'Monthly surveillance for Foot-and-Mouth Disease across East Africa',
    domain: 'animal_health',
    templateId: 'a0000001-0001-4000-8000-000000000001',
    templateIds: [
      'a0000001-0001-4000-8000-000000000001',
      'a0000001-0002-4000-8000-000000000002',
    ],
    targetCountries: ['KE', 'ET', 'UG', 'TZ'],
    startDate: '2026-03-01T00:00:00.000Z',
    endDate: '2026-06-30T00:00:00.000Z',
    targetSubmissions: 200,
  });
  const freshRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(freshBody),
    }
  }, freshBody);
  if (freshRes.status === 201) {
    const freshData = JSON.parse(freshRes.body);
    console.log('   Created:', freshData.data?.id, '|', freshData.data?.name);
    console.log('   Status:', freshData.data?.status);
  } else {
    console.log('   Create failed:', freshRes.body);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
