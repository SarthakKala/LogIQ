const express = require('express');
const { randomUUID } = require('crypto');

const COLLECTOR = process.env.COLLECTOR_URL || 'http://localhost:4000';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ service: 'fraud-service', ok: true }));

function pickLevel() {
  const u = Math.random();
  if (u < 0.9) return 'INFO';
  return 'WARN';
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

async function postIngest(body) {
  const r = await fetch(`${COLLECTOR}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`ingest ${r.status}: ${t}`);
  }
}

app.post('/process', async (req, res) => {
  try {
    const { traceId, journeyId, parentSpanId } = req.body;
    const spanId = randomUUID();
    const latencyMs = Math.round(randBetween(35, 150));
    const level = pickLevel();
    await postIngest({
      traceId,
      journeyId,
      spanId,
      parentSpanId,
      service: 'fraud-service',
      level,
      message:
        level === 'WARN'
          ? 'Fraud: elevated risk score'
          : 'Fraud: risk score acceptable',
      latencyMs,
      metadata: { stage: 'fraud' },
    });
    res.json({ spanId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3003, () => {
  console.log('fraud-service listening on :3003');
});
