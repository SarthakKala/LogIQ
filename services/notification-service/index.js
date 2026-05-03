const express = require('express');
const { randomUUID } = require('crypto');

const COLLECTOR = process.env.COLLECTOR_URL || 'http://localhost:4000';

const app = express();
app.use(express.json());

app.get('/health', (_, res) =>
  res.json({ service: 'notification-service', ok: true })
);

function pickLevel() {
  return Math.random() < 0.97 ? 'INFO' : 'ERROR';
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
    const latencyMs = Math.round(randBetween(40, 180));
    const level = pickLevel();
    await postIngest({
      traceId,
      journeyId,
      spanId,
      parentSpanId,
      service: 'notification-service',
      level,
      message:
        level === 'ERROR'
          ? 'Notification: delivery failed'
          : 'Notification: confirmation sent',
      latencyMs,
      metadata: { stage: 'notification' },
    });
    res.json({ spanId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3004, () => {
  console.log('notification-service listening on :3004');
});
