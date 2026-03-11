import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, THRESHOLDS, RAMP_PROFILE, getAuthHeaders, login } from './config.js';

export const options = {
  scenarios: {
    field_agents: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: RAMP_PROFILE,
      gracefulRampDown: '30s',
    },
  },
  thresholds: THRESHOLDS,
};

let token;

export function setup() {
  token = login();
  if (!token) {
    throw new Error('Authentication failed during setup');
  }
  return { token };
}

export default function (data) {
  const submission = {
    templateId: '00000000-0000-0000-0000-000000000001',
    data: {
      speciesCode: 'BOV',
      countryCode: 'KE',
      reportDate: new Date().toISOString().split('T')[0],
      affectedCount: randomIntBetween(1, 500),
      deadCount: randomIntBetween(0, 50),
      latitude: -1.2864 + Math.random() * 0.1,
      longitude: 36.8172 + Math.random() * 0.1,
      notes: `Load test submission ${randomString(8)}`,
    },
    status: 'DRAFT',
  };

  const res = http.post(
    `${BASE_URL}/api/v1/collecte/submissions`,
    JSON.stringify(submission),
    getAuthHeaders(data.token),
  );

  check(res, {
    'submission created (201 or 200)': (r) => r.status === 201 || r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  sleep(randomIntBetween(1, 3));
}
