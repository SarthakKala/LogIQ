const { randomUUID } = require('crypto');
const pool = require('../collector/db/postgres');
const MetricsEngine = require('../collector/classes/MetricsEngine');

async function insertLog(row) {
  await pool.query(
    `INSERT INTO logs (
      trace_id, journey_id, span_id, parent_span_id, service,
      level, message, latency_ms, timestamp, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      row.traceId,
      row.journeyId,
      row.spanId ?? null,
      row.parentSpanId ?? null,
      row.service,
      row.level,
      row.message,
      row.latencyMs,
      row.timestamp,
      row.metadata ?? null,
    ]
  );
}

describe('MetricsEngine', () => {
  const engine = new MetricsEngine(pool);

  test('journey status FAILED if any log has level ERROR', async () => {
    const journeyId = `jest-journey-fail-${randomUUID()}`;
    const ts = new Date('2026-05-03T12:00:00.000Z');
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 's1',
      parentSpanId: null,
      service: 'auth-service',
      level: 'INFO',
      message: 'ok',
      latencyMs: 10,
      timestamp: ts,
    });
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 's2',
      parentSpanId: 's1',
      service: 'payment-service',
      level: 'ERROR',
      message: 'fail',
      latencyMs: 20,
      timestamp: new Date(ts.getTime() + 1000),
    });

    const m = await engine.computeJourney(journeyId);
    expect(m).not.toBeNull();
    expect(m.status).toBe('FAILED');

    await pool.query('DELETE FROM logs WHERE journey_id = $1', [journeyId]);
    await pool.query('DELETE FROM journey_metrics WHERE journey_id = $1', [journeyId]);
  });

  test('journey status SUCCESS if all logs are INFO or WARN', async () => {
    const journeyId = `jest-journey-ok-${randomUUID()}`;
    const ts = new Date('2026-05-03T12:00:00.000Z');
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 's1',
      parentSpanId: null,
      service: 'auth-service',
      level: 'INFO',
      message: 'ok',
      latencyMs: 10,
      timestamp: ts,
    });
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 's2',
      parentSpanId: 's1',
      service: 'fraud-service',
      level: 'WARN',
      message: 'warn',
      latencyMs: 5,
      timestamp: new Date(ts.getTime() + 500),
    });

    const m = await engine.computeJourney(journeyId);
    expect(m).not.toBeNull();
    expect(m.status).toBe('SUCCESS');

    await pool.query('DELETE FROM logs WHERE journey_id = $1', [journeyId]);
    await pool.query('DELETE FROM journey_metrics WHERE journey_id = $1', [journeyId]);
  });

  test('totalLatencyMs equals sum of span latencyMs', async () => {
    const journeyId = `jest-journey-sum-${randomUUID()}`;
    const ts = new Date('2026-05-03T12:00:00.000Z');
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 'a',
      parentSpanId: null,
      service: 'auth-service',
      level: 'INFO',
      message: 'a',
      latencyMs: 100,
      timestamp: ts,
    });
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 'b',
      parentSpanId: 'a',
      service: 'fraud-service',
      level: 'INFO',
      message: 'b',
      latencyMs: 250,
      timestamp: new Date(ts.getTime() + 1000),
    });

    const m = await engine.computeJourney(journeyId);
    expect(m.totalLatencyMs).toBe(350);

    await pool.query('DELETE FROM logs WHERE journey_id = $1', [journeyId]);
    await pool.query('DELETE FROM journey_metrics WHERE journey_id = $1', [journeyId]);
  });

  test('errorService is the service of the ERROR log', async () => {
    const journeyId = `jest-journey-errsvc-${randomUUID()}`;
    const ts = new Date('2026-05-03T12:00:00.000Z');
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 'a',
      parentSpanId: null,
      service: 'auth-service',
      level: 'INFO',
      message: 'ok',
      latencyMs: 10,
      timestamp: ts,
    });
    await insertLog({
      traceId: randomUUID(),
      journeyId,
      spanId: 'b',
      parentSpanId: 'a',
      service: 'payment-service',
      level: 'ERROR',
      message: 'bad',
      latencyMs: 99,
      timestamp: new Date(ts.getTime() + 1000),
    });

    const m = await engine.computeJourney(journeyId);
    expect(m.errorService).toBe('payment-service');

    await pool.query('DELETE FROM logs WHERE journey_id = $1', [journeyId]);
    await pool.query('DELETE FROM journey_metrics WHERE journey_id = $1', [journeyId]);
  });
});
