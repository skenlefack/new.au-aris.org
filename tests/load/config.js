export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

export const THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1500'],
  http_req_failed: ['rate<0.01'],
  http_reqs: ['count>100'],
};

export const RAMP_PROFILE = [
  { duration: '30s', target: 100 },
  { duration: '1m', target: 500 },
  { duration: '2m', target: 1000 },
  { duration: '1m', target: 500 },
  { duration: '30s', target: 0 },
];

export function getAuthHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
}

export function login() {
  const res = http.post(
    `${BASE_URL}/api/v1/credential/auth/login`,
    JSON.stringify({
      email: __ENV.TEST_EMAIL || 'admin@au-aris.org',
      password: __ENV.TEST_PASSWORD || 'Aris2024!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (res.status !== 200) {
    console.error(`Login failed: ${res.status} ${res.body}`);
    return null;
  }
  return JSON.parse(res.body).data?.accessToken || JSON.parse(res.body).accessToken;
}

import http from 'k6/http';
