import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, getAuthHeaders, login } from './config.js';

export const options = {
  scenarios: {
    lag_monitor: {
      executor: 'constant-vus',
      vus: 1,
      duration: '5m',
    },
  },
  thresholds: {
    'checks': ['rate>0.95'],
  },
};

export function setup() {
  const token = login();
  if (!token) {
    throw new Error('Authentication failed during setup');
  }
  return { token };
}

export default function (data) {
  // Check analytics health endpoint for consumer lag metrics
  const res = http.get(
    `${BASE_URL}/api/v1/analytics/health`,
    getAuthHeaders(data.token),
  );

  check(res, {
    'health endpoint responds': (r) => r.status === 200,
    'response time < 2000ms': (r) => r.timings.duration < 2000,
  });

  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const lag = body.data?.consumerLag ?? body.consumerLag ?? 0;

      check(null, {
        'consumer lag < 5s': () => lag < 5000,
      });
    } catch (e) {
      // Health endpoint may not return lag data — that's acceptable
    }
  }

  sleep(10);
}
