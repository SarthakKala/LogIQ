/**
 * Stage 1 acceptance (build guide): instantiate all 3 classes, LogStore.insert dummy,
 * query back with queryLogs(). Requires Stage 0: docker-compose up, .env from .env.example.
 */
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../collector/db/postgres');
const redis = require('../collector/db/redis');
const { migrate } = require('../collector/db/migrate');
const LogStore = require('../collector/classes/LogStore');
const AnomalyDetector = require('../collector/classes/AnomalyDetector');
const MetricsEngine = require('../collector/classes/MetricsEngine');

async function main() {
  await migrate();

  const logStore = new LogStore(pool);
  const anomalyDetector = new AnomalyDetector(redis, pool);
  const metricsEngine = new MetricsEngine(pool);

  void anomalyDetector;
  void metricsEngine;

  const inserted = await logStore.insert({
    traceId: 'stage1-smoke-trace',
    journeyId: 'stage1-smoke-journey',
    spanId: 'span-1',
    parentSpanId: null,
    service: 'stage1-smoke-service',
    level: 'INFO',
    message: 'Stage 1 smoke test',
    latencyMs: 42,
    timestamp: new Date().toISOString(),
    metadata: { source: 'stage1-smoke' },
  });

  const rows = await logStore.queryLogs({ service: 'stage1-smoke-service', limit: 10 });
  const ok = rows.some((r) => r.id === inserted.id);
  if (!ok) {
    throw new Error('Round-trip failed: inserted row not returned by queryLogs');
  }

  console.log('Stage 1 smoke OK — LogStore insert + queryLogs round-trip (id=%s)', inserted.id);

  await pool.end();
  redis.disconnect();
}

main().catch((err) => {
  console.error('Stage 1 smoke failed:', err.message);
  process.exit(1);
});
