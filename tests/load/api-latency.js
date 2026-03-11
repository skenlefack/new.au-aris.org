import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { BASE_URL, THRESHOLDS, getAuthHeaders, login } from './config.js';

export const options = {
  scenarios: {
    mixed_api: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '2m', target: 200 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: THRESHOLDS,
};

export function setup() {
  const token = login();
  if (!token) {
    throw new Error('Authentication failed during setup');
  }
  return { token };
}

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/collecte/submissions?page=1&limit=20' },
  { method: 'GET', path: '/api/v1/collecte/campaigns?page=1&limit=20' },
  { method: 'GET', path: '/api/v1/master-data/species?page=1&limit=50' },
  { method: 'GET', path: '/api/v1/master-data/diseases?page=1&limit=50' },
  { method: 'GET', path: '/api/v1/workflow/instances?page=1&limit=20' },
  { method: 'GET', path: '/api/v1/analytics/health' },
  { method: 'GET', path: '/api/v1/credential/users/me' },
];

export default function (data) {
  const endpoint = API_ENDPOINTS[randomIntBetween(0, API_ENDPOINTS.length - 1)];

  group(`${endpoint.method} ${endpoint.path.split('?')[0]}`, () => {
    const res = http.request(
      endpoint.method,
      `${BASE_URL}${endpoint.path}`,
      null,
      getAuthHeaders(data.token),
    );

    check(res, {
      'status is 2xx': (r) => r.status >= 200 && r.status < 300,
      'response time p95 < 500ms': (r) => r.timings.duration < 500,
      'has response body': (r) => r.body && r.body.length > 0,
    });
  });

  sleep(randomIntBetween(1, 2));
}
