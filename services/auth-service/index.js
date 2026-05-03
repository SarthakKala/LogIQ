const express = require('express');
const { randomUUID } = require('crypto');

const COLLECTOR = process.env.COLLECTOR_URL || 'http://localhost:4000';
const FRAUD = process.env.FRAUD_SERVICE_URL || 'http://localhost:3003';
const PAYMENT = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002';
const NOTIFICATION = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

const app = express();
app.use(express.json());

app.get('/health', (_, res) => res.json({ service: 'auth-service', ok: true }));

function pickLevel() {
  return Math.random() < 0.95 ? 'INFO' : 'WARN';
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

async function runJourney() {
  const traceId = randomUUID();
  const journeyId = randomUUID();

  const authSpanId = randomUUID();
  const latencyMs = Math.round(randBetween(20, 90));
  const level = pickLevel();
  await postIngest({
    traceId,
    journeyId,
    spanId: authSpanId,
    parentSpanId: null,
    service: 'auth-service',
    level,
    message:
      level === 'WARN' ? 'Auth: token expiring soon' : 'Auth: token validated',
    latencyMs,
    metadata: { stage: 'auth' },
  });

  let r = await fetch(`${FRAUD}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ traceId, journeyId, parentSpanId: authSpanId }),
  });
  if (!r.ok) throw new Error(`fraud ${r.status}`);
  const fraudOut = await r.json();

  r = await fetch(`${PAYMENT}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      traceId,
      journeyId,
      parentSpanId: fraudOut.spanId,
    }),
  });
  if (!r.ok) throw new Error(`payment ${r.status}`);
  const paymentOut = await r.json();

  r = await fetch(`${NOTIFICATION}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      traceId,
      journeyId,
      parentSpanId: paymentOut.spanId,
    }),
  });
  if (!r.ok) throw new Error(`notification ${r.status}`);
}

function scheduleNext() {
  const delay = 3000 + Math.random() * 5000;
  setTimeout(async () => {
    try {
      await runJourney();
    } catch (e) {
      console.error('[auth-service] journey error', e.message);
    }
    scheduleNext();
  }, delay);
}

app.listen(3001, () => {
  console.log('auth-service listening on :3001 (orchestrator)');
  scheduleNext();
});
