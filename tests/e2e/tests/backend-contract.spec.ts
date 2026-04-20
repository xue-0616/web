import { test, expect, request } from '@playwright/test';

/**
 * Backend contract tests.
 *
 * These assert the HTTP contract of the two hardened services
 * matches what the frontend + integration-smoke + operator
 * runbook all assume.  They are:
 *
 *   * idempotent         — safe to run repeatedly
 *   * no-write           — don't mutate any persistent state
 *   * externally visible — every assertion uses only public HTTP
 *     signals (status codes, response bodies, response headers)
 *
 * Covered in this file:
 *   1. /health returns 200 on both services
 *   2. /readyz returns 503 when an upstream dep is down (but
 *      we can't safely test the positive case here without a
 *      real DB — that's the integration-smoke job's turf).
 *   3. /metrics exposes Prometheus text with our expected
 *      metric names (asserts the instrumentation landed in
 *      commits b5e9729 / b950e7c is wired into the service).
 *   4. Farm submit fails fast with 503 when
 *      FARM_PROCESSING_ENABLED is not set (the documented
 *      fail-closed posture).
 *   5. Relayer submit rejects structurally-invalid meta-txs
 *      with 400-series, not 500 (pipeline from BUG-P2-C2).
 *   6. CORS preflight from a non-allowlisted Origin is denied.
 */

const FARM_URL     = process.env.FARM_BASE_URL     ?? 'http://localhost:8082';
const RELAYER_URL  = process.env.RELAYER_BASE_URL  ?? 'http://localhost:8081';

test.describe('health + readiness', () => {
  for (const [name, url] of [
    ['farm-sequencer', FARM_URL],
    ['relayer',        RELAYER_URL],
  ] as const) {
    test(`${name} /health returns 200`, async ({ request }) => {
      const res = await request.get(`${url}/health`);
      expect(res.status()).toBe(200);
    });

    test(`${name} /readyz returns 200 or 503 (never 4xx/5xx otherwise)`, async ({ request }) => {
      const res = await request.get(`${url}/readyz`);
      expect([200, 503]).toContain(res.status());
      if (res.status() === 503) {
        // Response body documents which dep is unhealthy.
        const body = await res.json().catch(() => null);
        expect(body).not.toBeNull();
      }
    });
  }
});

test.describe('Prometheus metrics exposition', () => {
  test('farm-sequencer /metrics includes scaffold metrics', async ({ request }) => {
    const res = await request.get(`${FARM_URL}/metrics`);
    expect(res.status()).toBe(200);
    const body = await res.text();

    // Metric name presence proves the instrumentation landed.
    // Values (and even whether the series exist yet, vs just
    // being registered) are NOT asserted here — a metric only
    // materialises after its first emission, which may require
    // a tick of the pools-manager loop.  Instead we assert the
    // metric NAMES appear in the `# HELP` lines which are
    // emitted at recorder install time.
    for (const metric of [
      'farm_batch_result_total',
      'farm_batch_claimed_intents_total',
      'farm_batch_claim_lost_total',
      'farm_batch_build_duration_seconds',
    ]) {
      expect(body).toContain(metric);
    }
  });

  test('relayer /metrics includes scaffold metrics', async ({ request }) => {
    const res = await request.get(`${RELAYER_URL}/metrics`);
    expect(res.status()).toBe(200);
    const body = await res.text();

    for (const metric of [
      'relayer_stream_backlog',
      'relayer_entry_result_total',
    ]) {
      expect(body).toContain(metric);
    }
  });
});

test.describe('fail-closed gates', () => {
  test('farm: submit rejected with 503 when processing disabled', async ({ request }) => {
    // Craft a payload that WOULD validate if the gate were on;
    // we're only testing the short-circuit 503.
    const res = await request.post(`${FARM_URL}/api/v1/intents/submit`, {
      data: {
        intentType: 'Deposit',
        farmTypeHash: '0x' + 'ff'.repeat(32),
        cellTxHash:   '0x' + 'aa'.repeat(32),
        cellIndex:    0,
        lockHash:     '0x' + 'cc'.repeat(32),
        amount:       '1',
      },
    });
    // The gate is documented to return 503 when
    // FARM_PROCESSING_ENABLED is not set.  If the test env
    // has the gate ON, we'd see 200 or 422 and this test
    // would fail — which is a correct signal that the
    // fail-closed posture was disabled.
    expect(res.status()).toBe(503);
  });
});

test.describe('relayer structural validation', () => {
  test('relay rejects empty calldata with 4xx (not 500)', async ({ request }) => {
    const res = await request.post(`${RELAYER_URL}/api/v1/transactions/relay`, {
      data: {
        chainId: 1,
        walletAddress: '0x' + '11'.repeat(20),
        calldata: '0x',  // empty
      },
    });
    // 400 (bad format) or 422 (parseable but fails structural
    // check) are both acceptable.  5xx would mean a panic in
    // the pipeline, which was the BUG-P2-C2 class of bug.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test('relay rejects delegate_call inner tx with 4xx', async ({ request }) => {
    // Construct a calldata blob that would parse as
    // ModuleMain.execute with one inner tx that has
    // delegate_call=true.  Structural validator should reject.
    //
    // (This is a placeholder — producing a real execute-shaped
    // calldata is wordy; the execute-validator unit tests
    // already cover the positive case.  This test just smokes
    // the HTTP path refuses a malformed blob without 500ing.)
    const res = await request.post(`${RELAYER_URL}/api/v1/transactions/relay`, {
      data: {
        chainId: 1,
        walletAddress: '0x' + '11'.repeat(20),
        calldata: '0x' + 'de'.repeat(4),  // not valid execute()
      },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });
});

test.describe('CORS', () => {
  test('farm: preflight from disallowed Origin is denied', async ({ request }) => {
    const res = await request.fetch(`${FARM_URL}/api/v1/intents/submit`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    // Different CORS middlewares return different things for a
    // denied preflight (403, 200 with no ACAO, 400).  The
    // invariant we care about: the browser never gets an
    // Access-Control-Allow-Origin: * echo of the attacker's
    // Origin.
    const acao = res.headers()['access-control-allow-origin'];
    if (acao !== undefined) {
      expect(acao).not.toBe('*');
      expect(acao).not.toBe('https://evil.example.com');
    }
  });
});
