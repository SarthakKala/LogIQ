const request = require('supertest');
const { randomUUID } = require('crypto');
const { buildApp } = require('../collector/createApp');
const pool = require('../collector/db/postgres');

describe('collector HTTP API', () => {
  let app;

  beforeAll(async () => {
    app = await buildApp({ startWebSocket: false });
  });

  test('POST /ingest → 201 and log row exists in PostgreSQL', async () => {
    const traceId = `jest-ingest-${randomUUID()}`;
    const journeyId = `jest-journey-${randomUUID()}`;
    const res = await request(app)
      .post('/ingest')
      .send({
        traceId,
        journeyId,
        spanId: 'span-ingest-1',
        parentSpanId: null,
        service: 'auth-service',
        level: 'INFO',
        message: 'integration ingest',
        latencyMs: 12,
      });
    expect(res.status).toBe(201);
    expect(res.body.trace_id).toBe(traceId);

    const { rows } = await pool.query('SELECT * FROM logs WHERE trace_id = $1', [traceId]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].message).toBe('integration ingest');

    await pool.query('DELETE FROM logs WHERE trace_id = $1', [traceId]);
    await pool.query('DELETE FROM journey_metrics WHERE journey_id = $1', [journeyId]);
  });

  test('GET /logs?service=auth-service returns only auth-service logs', async () => {
    const t1 = `jest-filter-a-${randomUUID()}`;
    const t2 = `jest-filter-b-${randomUUID()}`;
    await request(app).post('/ingest').send({
      traceId: t1,
      journeyId: randomUUID(),
      service: 'auth-service',
      level: 'INFO',
      message: 'a',
      latencyMs: 1,
    });
    await request(app).post('/ingest').send({
      traceId: t2,
      journeyId: randomUUID(),
      service: 'payment-service',
      level: 'INFO',
      message: 'b',
      latencyMs: 2,
    });

    const res = await request(app).get('/logs').query({ service: 'auth-service', limit: 500 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((r) => r.service === 'auth-service')).toBe(true);

    await pool.query('DELETE FROM logs WHERE trace_id = ANY($1::text[])', [[t1, t2]]);
  });

  test('GET /traces/:traceId returns spans sorted by timestamp ASC', async () => {
    const traceId = `jest-trace-sort-${randomUUID()}`;
    const base = new Date('2026-05-03T15:00:00.000Z').getTime();
    await request(app)
      .post('/ingest')
      .send({
        traceId,
        journeyId: randomUUID(),
        spanId: 's1',
        parentSpanId: null,
        service: 'auth-service',
        level: 'INFO',
        message: 'first',
        latencyMs: 1,
        timestamp: new Date(base).toISOString(),
      });
    await request(app)
      .post('/ingest')
      .send({
        traceId,
        journeyId: randomUUID(),
        spanId: 's2',
        parentSpanId: 's1',
        service: 'fraud-service',
        level: 'INFO',
        message: 'second',
        latencyMs: 2,
        timestamp: new Date(base + 5000).toISOString(),
      });

    const res = await request(app).get(`/traces/${encodeURIComponent(traceId)}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < res.body.length; i++) {
      const a = new Date(res.body[i - 1].timestamp).getTime();
      const b = new Date(res.body[i].timestamp).getTime();
      expect(b).toBeGreaterThanOrEqual(a);
    }

    await pool.query('DELETE FROM logs WHERE trace_id = $1', [traceId]);
  });

  test('GET /health → status ok and DB + Redis connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      dbConnected: true,
      redisConnected: true,
    });
  });

  test('GET /metrics/summary has expected fields', async () => {
    const res = await request(app).get('/metrics/summary');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalJourneys');
    expect(res.body).toHaveProperty('successRate');
    expect(res.body).toHaveProperty('avgLatency');
    expect(res.body).toHaveProperty('topErrorService');
  });
});
