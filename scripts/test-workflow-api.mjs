// Quick script to test workflow definitions API
const CRED_URL = 'http://localhost:3002';
const COLLECTE_URL = 'http://localhost:3011';

async function main() {
  // 1. Login
  console.log('1. Logging in as admin@au-aris.org ...');
  const loginRes = await fetch(`${CRED_URL}/api/v1/credential/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@au-aris.org', password: 'Aris2024!' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }
  const token = loginData.data?.accessToken;
  const tenantId = loginData.data?.user?.tenantId;
  console.log(`   OK — tenantId: ${tenantId}, token: ${token?.slice(0, 20)}...`);

  // 2. Fetch workflow definitions
  console.log('\n2. Fetching workflow definitions ...');
  const wfRes = await fetch(`${COLLECTE_URL}/api/v1/workflow/definitions?limit=5`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  });
  console.log(`   Status: ${wfRes.status}`);
  const wfData = await wfRes.json();

  if (wfData.meta) {
    console.log(`   Total: ${wfData.meta.total} workflows`);
  }
  if (wfData.data?.length > 0) {
    for (const wf of wfData.data.slice(0, 5)) {
      const name = wf.name?.en ?? '?';
      const steps = wf.steps?.length ?? '?';
      const country = wf.country?.code ?? '?';
      console.log(`   ${country}: ${name} (${steps} steps)`);
    }
  } else {
    console.log('   NO DATA — raw response:');
    console.log(JSON.stringify(wfData, null, 2).slice(0, 500));
  }

  // 3. Fetch validation chains
  console.log('\n3. Fetching validation chains ...');
  const chainRes = await fetch(`${COLLECTE_URL}/api/v1/workflow/validation-chains?limit=5`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  });
  const chainData = await chainRes.json();
  if (chainData.meta) {
    console.log(`   Total: ${chainData.meta.total} chains`);
  }
  if (chainData.data?.length > 0) {
    for (const ch of chainData.data.slice(0, 3)) {
      console.log(`   ${ch.user?.email ?? ch.userId?.slice(0,8)} → ${ch.validator?.email ?? ch.validatorId?.slice(0,8)} [${ch.levelType}]`);
    }
  } else {
    console.log('   NO DATA — raw response:');
    console.log(JSON.stringify(chainData, null, 2).slice(0, 500));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
