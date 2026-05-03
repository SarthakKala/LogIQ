const pool = require('./postgres');

// One statement per query — reliable with Supabase (multi-statement strings can fail via some poolers).
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    trace_id VARCHAR(64),
    journey_id VARCHAR(64),
    span_id VARCHAR(64),
    parent_span_id VARCHAR(64),
    service VARCHAR(64),
    level VARCHAR(10),
    message TEXT,
    latency_ms INTEGER,
    timestamp TIMESTAMPTZ,
    metadata JSONB
  )`,
  `CREATE TABLE IF NOT EXISTS journey_metrics (
    id SERIAL PRIMARY KEY,
    journey_id VARCHAR(64) UNIQUE,
    status VARCHAR(10),
    total_latency_ms INTEGER,
    error_service VARCHAR(64),
    span_count INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS anomalies (
    id SERIAL PRIMARY KEY,
    service VARCHAR(64),
    latency_ms INTEGER,
    baseline_mean FLOAT,
    baseline_stddev FLOAT,
    detected_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

async function migrate() {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
}

module.exports = { migrate };
