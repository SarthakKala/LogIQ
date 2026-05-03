class MetricsEngine {
  constructor(pgPool) {
    this.db = pgPool;
  }

  async computeJourney(journeyId) {
    const { rows: logs } = await this.db.query(
      `SELECT * FROM logs WHERE journey_id = $1 ORDER BY timestamp ASC`,
      [journeyId]
    );

    if (logs.length === 0) {
      return null;
    }

    const totalLatencyMs = logs.reduce((sum, row) => sum + (row.latency_ms ?? 0), 0);
    const errorRow = logs.find((r) => r.level === 'ERROR');
    const status = errorRow ? 'FAILED' : 'SUCCESS';
    const errorService = errorRow ? errorRow.service : null;
    const spanCount = logs.length;
    const startTime = logs[0].timestamp;
    const endTime = logs[logs.length - 1].timestamp;

    const { rows } = await this.db.query(
      `INSERT INTO journey_metrics (
        journey_id, status, total_latency_ms, error_service, span_count, start_time, end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (journey_id) DO UPDATE SET
        status = EXCLUDED.status,
        total_latency_ms = EXCLUDED.total_latency_ms,
        error_service = EXCLUDED.error_service,
        span_count = EXCLUDED.span_count,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time
      RETURNING *`,
      [journeyId, status, totalLatencyMs, errorService, spanCount, startTime, endTime]
    );

    const row = rows[0];
    return {
      journeyId: row.journey_id,
      status: row.status,
      totalLatencyMs: row.total_latency_ms,
      errorService: row.error_service,
      spanCount: row.span_count,
      startTime: row.start_time,
      endTime: row.end_time,
    };
  }

  async getSummary() {
    const { rows: agg } = await this.db.query(`
      SELECT
        COUNT(*)::int AS total_journeys,
        COALESCE(AVG(total_latency_ms)::float, 0) AS avg_latency,
        CASE WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE status = 'SUCCESS'))::float / COUNT(*)::float
          ELSE 0
        END AS success_rate
      FROM journey_metrics
    `);

    const { rows: topErr } = await this.db.query(`
      SELECT error_service, COUNT(*)::int AS cnt
      FROM journey_metrics
      WHERE error_service IS NOT NULL
      GROUP BY error_service
      ORDER BY cnt DESC
      LIMIT 1
    `);

    const base = agg[0] || {
      total_journeys: 0,
      avg_latency: 0,
      success_rate: 0,
    };

    return {
      totalJourneys: base.total_journeys,
      successRate: base.success_rate,
      avgLatency: base.avg_latency,
      topErrorService: topErr[0]?.error_service ?? null,
    };
  }

  async getAnomalies(limit = 20) {
    const { rows } = await this.db.query(
      `SELECT * FROM anomalies ORDER BY detected_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }
}

module.exports = MetricsEngine;
