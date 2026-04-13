import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const failedRequests = new Counter('failed_requests');
const checkRate = new Rate('check_pass_rate');
const latencyTrend = new Trend('api_latency_ms');

export const options = {
  vus: Number(__ENV.K6_VUS || 10),
  duration: __ENV.K6_DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.1'],
    http_req_duration: ['p(95)<1500'],
  },
};

const BASE_URL = (__ENV.K6_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const REPORT_URL = __ENV.K6_REPORT_URL || `${BASE_URL}/api/load-test/report`;

const routes = [
  '/',
  '/api/dashboard',
  '/api/health',
  '/api/forum/status?userId=loadtest-user',
];

export default function () {
  const route = routes[Math.floor(Math.random() * routes.length)];
  const res = http.get(`${BASE_URL}${route}`, { timeout: '15s' });
  latencyTrend.add(res.timings.duration);

  const ok = check(res, {
    'status < 500': (r) => r.status < 500,
  });
  checkRate.add(ok ? 1 : 0);
  if (!ok) failedRequests.add(1);
  sleep(0.4);
}

export function handleSummary(data) {
  const totalRequests = Number(data.metrics.http_reqs?.values?.count || 0);
  const failed = Number(data.metrics.http_req_failed?.values?.fails || 0);
  const reportPayload = {
    runId: `K6-${Date.now().toString(36).toUpperCase()}`,
    scenario: __ENV.K6_SCENARIO || 'baseline_mix',
    environment: __ENV.K6_ENV || 'local',
    baseUrl: BASE_URL,
    vus: Number(options.vus || 0),
    iterations: Number(data.metrics.iterations?.values?.count || 0),
    totalRequests,
    failedRequests: failed,
    avgMs: Number(data.metrics.http_req_duration?.values?.avg || 0),
    minMs: Number(data.metrics.http_req_duration?.values?.min || 0),
    maxMs: Number(data.metrics.http_req_duration?.values?.max || 0),
    p90Ms: Number(data.metrics.http_req_duration?.values?.['p(90)'] || 0),
    p95Ms: Number(data.metrics.http_req_duration?.values?.['p(95)'] || 0),
    p99Ms: Number(data.metrics.http_req_duration?.values?.['p(99)'] || 0),
    checksPassRate: Number(data.metrics.checks?.values?.rate || 0) * 100,
    source: 'k6',
    notes: __ENV.K6_NOTES || '',
    startedAt: new Date(Date.now() - Number(data.state?.testRunDurationMs || 0)).toISOString(),
    finishedAt: new Date().toISOString(),
  };

  const headers = { 'Content-Type': 'application/json' };
  if (__ENV.LOAD_TEST_REPORT_TOKEN) {
    headers['x-loadtest-token'] = __ENV.LOAD_TEST_REPORT_TOKEN;
  }

  try {
    const resp = http.post(REPORT_URL, JSON.stringify(reportPayload), { headers, timeout: '20s' });
    if (resp.status >= 400) {
      console.error(`Gagal kirim report load test: HTTP ${resp.status} ${resp.body}`);
    }
  } catch (err) {
    console.error(`Gagal kirim report load test: ${err.message || err}`);
  }

  return {
    stdout: JSON.stringify({ summary: data.metrics.http_req_duration?.values || {}, reportPayload }, null, 2),
  };
}
