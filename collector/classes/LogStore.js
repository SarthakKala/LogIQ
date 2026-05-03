class LogStore {
  constructor(pgPool) {
    this.db = pgPool;
  }

  async insert(logEntry) {
    const {
      traceId,
      journeyId,
      spanId,
      parentSpanId,
      service,
      level,
      message,
      latencyMs,
      timestamp,
      metadata,
    } = logEntry;

    const ts =
      timestamp instanceof Date ? timestamp : timestamp ? new Date(timestamp) : new Date();

    const { rows } = await this.db.query(
      `INSERT INTO logs (
        trace_id, journey_id, span_id, parent_span_id, service,
        level, message, latency_ms, timestamp, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        traceId ?? null,
        journeyId ?? null,
        spanId ?? null,
        parentSpanId ?? null,
        service,
        level,
        message,
        latencyMs ?? null,
        ts,
        metadata ?? null,
      ]
    );
    return rows[0];
  }

  async queryLogs({ service, level, since, limit = 100 }) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (service) {
      conditions.push(`service = $${i++}`);
      params.push(service);
    }
    if (level) {
      conditions.push(`level = $${i++}`);
      params.push(level);
    }
    if (since) {
      conditions.push(`timestamp >= $${i++}`);
      params.push(new Date(since));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 500));

    const { rows } = await this.db.query(
      `SELECT * FROM logs ${where} ORDER BY timestamp DESC LIMIT $${i}`,
      params
    );
    return rows;
  }

  async getByTraceId(traceId) {
    const { rows } = await this.db.query(
      `SELECT * FROM logs WHERE trace_id = $1 ORDER BY timestamp ASC`,
      [traceId]
    );
    return rows;
  }

  async getByJourneyId(journeyId) {
    const { rows } = await this.db.query(
      `SELECT * FROM logs WHERE journey_id = $1 ORDER BY timestamp ASC`,
      [journeyId]
    );
    return rows;
  }

  async getRecentForContext(limit = 100) {
    const { rows } = await this.db.query(
      `SELECT * FROM logs ORDER BY timestamp DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
  
}

module.exports = LogStore;
