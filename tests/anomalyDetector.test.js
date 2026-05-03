const Redis = require('ioredis');
const AnomalyDetector = require('../collector/classes/AnomalyDetector');
const pool = require('../collector/db/postgres');

describe('AnomalyDetector', () => {
  let redis;

  beforeAll(() => {
    redis = new Redis(process.env.REDIS_URL);
  });

  afterAll(async () => {
    await redis.quit();
  });

  test('computeStats returns correct mean and stddev for [100,100,100,100,200]', () => {
    const detector = new AnomalyDetector(redis, pool);
    const { mean, stddev } = detector.computeStats([100, 100, 100, 100, 200]);
    expect(mean).toBeCloseTo(120, 5);
    expect(stddev).toBeCloseTo(40, 5);
  });

  test('no anomaly when new value is within mean + 2*stddev', async () => {
    const svc = `jest-anomaly-quiet-${Date.now()}`;
    const key = `latency_window:${svc}`;
    await redis.del(key);

    const detector = new AnomalyDetector(redis, pool);
    for (let i = 0; i < 15; i++) {
      await detector.addReading(svc, 145 + (i % 11));
    }
    const result = await detector.detect(svc, 154);
    expect(result).toBeNull();

    await redis.del(key);
  });

  test('anomaly when spike exceeds mean + 2*stddev', async () => {
    const svc = `jest-anomaly-spike-${Date.now()}`;
    const key = `latency_window:${svc}`;
    await redis.del(key);

    const detector = new AnomalyDetector(redis, pool);
    for (let i = 0; i < 49; i++) {
      await detector.addReading(svc, 150);
    }
    const result = await detector.detect(svc, 3000);
    expect(result).not.toBeNull();
    expect(result.service).toBe(svc);
    expect(result.latencyMs).toBe(3000);

    await pool.query('DELETE FROM anomalies WHERE service = $1', [svc]);
    await redis.del(key);
  });

  test('Redis window never exceeds windowSize after many pushes', async () => {
    const svc = `jest-anomaly-window-${Date.now()}`;
    const key = `latency_window:${svc}`;
    await redis.del(key);

    const detector = new AnomalyDetector(redis, pool, 50, 2);
    for (let i = 0; i < 60; i++) {
      await detector.addReading(svc, 100 + i);
    }
    const len = await redis.llen(key);
    expect(len).toBe(50);

    await redis.del(key);
  });
});
