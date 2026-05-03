const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

const SYSTEM_PROMPT = `You are LogIQ, an observability intelligence engine for a distributed payment system.
You have access to real ingested log data from PostgreSQL, anomaly detections, journey metrics,
and per-service latency windows from Redis.
Answer questions about system health, failures, latency, and incidents strictly based on the data provided.
Do not guess or hallucinate. If the data does not support a conclusion, say so explicitly.
Be concise, technical, and specific — always mention service names, timestamps, and latency values.`;

const MOCK_SERVICES = [
  'auth-service',
  'fraud-service',
  'payment-service',
  'notification-service',
];

/** ~6000 tokens budget — rough char cap for JSON context */
const MAX_CONTEXT_CHARS = 22000;

function truncateMessage(msg, maxLen = 120) {
  if (msg == null) return null;
  const s = String(msg);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

function createLlm({ logStore, metricsEngine, redis }) {
  async function buildContext(question) {
    const [logs, anomalies, summary] = await Promise.all([
      logStore.getRecentForContext(100),
      metricsEngine.getAnomalies(20),
      metricsEngine.getSummary(),
    ]);

    const latencyWindows = {};
    for (const svc of MOCK_SERVICES) {
      const raw = await redis.lrange(`latency_window:${svc}`, 0, -1);
      latencyWindows[svc] = raw.map(Number);
    }

    const slimLogs = logs.map((row) => ({
      trace_id: row.trace_id,
      journey_id: row.journey_id,
      service: row.service,
      level: row.level,
      message: truncateMessage(row.message),
      latency_ms: row.latency_ms,
      timestamp: row.timestamp,
    }));

    const payload = {
      question,
      summaryMetrics: summary,
      anomalies,
      logs: slimLogs,
      latencyWindows,
    };

    let json = JSON.stringify(payload);
    while (json.length > MAX_CONTEXT_CHARS && slimLogs.length > 20) {
      slimLogs.pop();
      payload.logs = slimLogs;
      json = JSON.stringify(payload);
    }

    return json;
  }

  async function answer(question) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_key_here') {
      throw new Error('OPENROUTER_API_KEY is missing or not set in .env');
    }

    const contextJson = await buildContext(question);

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Referer: process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:4000',
        'X-Title': 'LogIQ',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Question:\n${question}\n\nData context (JSON):\n${contextJson}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${text}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter returned no message content');
    }
    return content.trim();
  }

  return { buildContext, answer };
}

module.exports = { createLlm };
