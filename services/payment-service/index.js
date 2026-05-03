const express = require('express');
const { randomUUID } = require('crypto');

const COLLECTOR = process.env.COLLECTOR_URL || 'http://localhost:4000';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ service: 'payment-service', ok: true }));

function pickLevel() {
  const u = Math.random();
  if (u < 0.78) return 'INFO';
  if (u < 0.95) return 'ERROR';
  return 'WARN';
}

/** Guide: 70% → 80–300ms, 30% → 1500–4000ms */
function sampleLatencyMs() {
  if (Math.random() < 0.7) {
    return Math.round(80 + Math.random() * (300 - 80));
  }
  return Math.round(1500 + Math.random() * (4000 - 1500));
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
    const latencyMs = sampleLatencyMs();
    const level = pickLevel();
    let message = 'Payment: captured';
    if (level === 'ERROR') message = 'Payment processing failed: timeout';
    else if (level === 'WARN') message = 'Payment: retry scheduled';

    await postIngest({
      traceId,
      journeyId,
      spanId,
      parentSpanId,
      service: 'payment-service',
      level,
      message,
      latencyMs,
      metadata: { stage: 'payment' },
    });
    res.json({ spanId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3002, () => {
  console.log('payment-service listening on :3002');
});
