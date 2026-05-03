const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');

const pool = require('./db/postgres');
const redis = require('./db/redis');
const { migrate } = require('./db/migrate');
const LogStore = require('./classes/LogStore');
const AnomalyDetector = require('./classes/AnomalyDetector');
const MetricsEngine = require('./classes/MetricsEngine');
const { broadcast } = require('./websocket');

const app = express();
app.use(express.json());

const logStore = new LogStore(pool);
const anomalyDetector = new AnomalyDetector(redis, pool);
const metricsEngine = new MetricsEngine(pool);

const PORT = Number(process.env.COLLECTOR_PORT) || 4000;

function normalizeIngestBody(body) {
  return {
    traceId: body.traceId,
    journeyId: body.journeyId ?? null,
    spanId: body.spanId ?? null,
    parentSpanId: body.parentSpanId ?? null,
    service: body.service,
    level: body.level,
    message: body.message,
    latencyMs: body.latencyMs ?? null,
    timestamp: body.timestamp ?? new Date().toISOString(),
    metadata: body.metadata ?? null,
  };
}

app.post('/ingest', async (req, res) => {
  const { traceId, service, level, message } = req.body || {};
  if (!traceId || !service || !level || message == null || String(message) === '') {
    return res.status(400).json({
      error: 'traceId, service, level, and message are required',
    });
  }

  try {
    const payload = normalizeIngestBody(req.body);
    const row = await logStore.insert(payload);

    const latencyMs = payload.latencyMs ?? 0;
    await anomalyDetector.detect(service, latencyMs);

    if (payload.journeyId) {
      await metricsEngine.computeJourney(payload.journeyId);
    }

    broadcast(row);
    return res.status(201).json(row);
  } catch (err) {
    console.error('POST /ingest', err);
    return res.status(500).json({ error: 'Ingest failed' });
  }
});

app.get('/logs', async (req, res) => {
  try {
    const rows = await logStore.queryLogs(req.query);
    res.json(rows);
  } catch (err) {
    console.error('GET /logs', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/traces/:traceId', async (req, res) => {
  try {
    const rows = await logStore.getByTraceId(req.params.traceId);
    res.json(rows);
  } catch (err) {
    console.error('GET /traces', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/journeys/:journeyId', async (req, res) => {
  try {
    const rows = await logStore.getByJourneyId(req.params.journeyId);
    res.json(rows);
  } catch (err) {
    console.error('GET /journeys', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/metrics/summary', async (req, res) => {
  try {
    const summary = await metricsEngine.getSummary();
    res.json(summary);
  } catch (err) {
    console.error('GET /metrics/summary', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/metrics/journey/:journeyId', async (req, res) => {
  try {
    const metrics = await metricsEngine.computeJourney(req.params.journeyId);
    if (!metrics) return res.status(404).json({ error: 'Journey not found' });
    res.json(metrics);
  } catch (err) {
    console.error('GET /metrics/journey', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.get('/anomalies', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const rows = await metricsEngine.getAnomalies(limit);
    res.json(rows);
  } catch (err) {
    console.error('GET /anomalies', err);
    res.status(500).json({ error: 'Query failed' });
  }
});

app.post('/ask', (req, res) => {
  res.status(501).json({
    error: 'POST /ask is implemented in Stage 4 (LLM).',
  });
});

app.get('/health', async (req, res) => {
  let dbConnected = false;
  let redisConnected = false;
  try {
    await pool.query('SELECT 1');
    dbConnected = true;
  } catch (e) {
    console.error('health db', e.message);
  }
  try {
    const pong = await redis.ping();
    redisConnected = pong === 'PONG';
  } catch (e) {
    console.error('health redis', e.message);
  }
  res.json({
    status: 'ok',
    dbConnected,
    redisConnected,
  });
});

async function main() {
  await migrate();
  app.listen(PORT, () => {
    console.log(`LogIQ collector listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Collector failed to start', err);
  process.exit(1);
});
