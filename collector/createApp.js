const express = require('express');
const cors = require('cors');

const pool = require('./db/postgres');
const redis = require('./db/redis');
const { migrate } = require('./db/migrate');
const LogStore = require('./classes/LogStore');
const AnomalyDetector = require('./classes/AnomalyDetector');
const MetricsEngine = require('./classes/MetricsEngine');
const { createLlm } = require('./llm');
const { broadcast, startWebSocketServer } = require('./websocket');

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

/**
 * Build Express app (shared by `collector/index.js` and Jest integration tests).
 * @param {{ startWebSocket?: boolean }} [opts]
 */
async function buildApp(opts = {}) {
  const { startWebSocket = false } = opts;

  await migrate();

  if (startWebSocket) {
    const WS_PORT = Number(process.env.COLLECTOR_WS_PORT) || 4001;
    startWebSocketServer(WS_PORT);
  }

  const logStore = new LogStore(pool);
  const anomalyDetector = new AnomalyDetector(redis, pool);
  const metricsEngine = new MetricsEngine(pool);
  const llm = createLlm({ logStore, metricsEngine, redis });

  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

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

  app.post('/ask', async (req, res) => {
    const { question } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }
    try {
      const answer = await llm.answer(question.trim());
      return res.json({ answer });
    } catch (err) {
      console.error('POST /ask', err);
      return res.status(500).json({ error: err.message || 'Ask failed' });
    }
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

  return app;
}

module.exports = { buildApp };
