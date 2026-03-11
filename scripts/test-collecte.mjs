import http from 'http';

function httpReq(opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
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
  console.log('Login OK');

  // 2. Create a new test campaign with proper templateIds and targetCountries
  const createBody = JSON.stringify({
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
    targetZones: [],
    assignedAgents: [],
    targetSubmissions: 200,
    frequency: 'monthly',
  });

  console.log('\n--- CREATE campaign ---');
  const createRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(createBody),
    }
  }, createBody);

  console.log('Status:', createRes.status);
  const created = JSON.parse(createRes.body);
  if (createRes.status === 201) {
    console.log('Created campaign:', created.data?.id, created.data?.name);
    console.log('  templateIds:', JSON.stringify(created.data?.templateIds));
    console.log('  targetCountries:', JSON.stringify(created.data?.targetCountries));
    console.log('  status:', created.data?.status);
  } else {
    console.log('Create failed:', createRes.body);
    return;
  }

  const campId = created.data.id;

  // 3. Test GET single campaign
  console.log('\n--- GET campaign ---');
  const getRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns/' + campId,
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', getRes.status);
  if (getRes.status === 200) {
    const getBody = JSON.parse(getRes.body);
    console.log('  name:', getBody.data?.name);
    console.log('  templateIds:', JSON.stringify(getBody.data?.templateIds));
    console.log('  targetCountries:', JSON.stringify(getBody.data?.targetCountries));
  }

  // 4. Test PATCH
  console.log('\n--- PATCH campaign ---');
  const patchBody = JSON.stringify({
    name: 'FMD Surveillance Q1 2026 (Updated)',
    templateIds: [
      'a0000001-0001-4000-8000-000000000001',
      'a0000001-0003-4000-8000-000000000003',
    ],
    targetCountries: ['KE', 'ET', 'UG', 'TZ', 'RW'],
  });
  const patchRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns/' + campId,
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(patchBody),
    }
  }, patchBody);
  console.log('Status:', patchRes.status);
  if (patchRes.status === 200) {
    const patchData = JSON.parse(patchRes.body);
    console.log('  Updated name:', patchData.data?.name);
    console.log('  Updated templateIds:', JSON.stringify(patchData.data?.templateIds));
    console.log('  Updated targetCountries:', JSON.stringify(patchData.data?.targetCountries));
  } else {
    console.log('PATCH failed:', patchRes.body);
  }

  // 5. List to verify
  console.log('\n--- LIST campaigns ---');
  const listRes = await httpReq({
    hostname: 'localhost', port: 3011,
    path: '/api/v1/collecte/campaigns?limit=10',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Status:', listRes.status);
  const listData = JSON.parse(listRes.body);
  console.log('Total:', listData.meta?.total);
  if (listData.data) {
    for (const c of listData.data) {
      console.log(`  ${c.id} | ${c.status} | ${c.name} | tplIds: ${JSON.stringify(c.templateIds)} | countries: ${JSON.stringify(c.targetCountries)}`);
    }
  }

  console.log('\nDone! Campaign ready for testing in the UI.');
}

main().catch(console.error);
