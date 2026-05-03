class AnomalyDetector {
  constructor(redisClient, pgPool, windowSize = 50, threshold = 2) {
    this.redis = redisClient;
    this.db = pgPool;
    this.windowSize = windowSize;
    this.threshold = threshold; // stddev multiplier
  }

  async addReading(service, latencyMs) {
    const key = `latency_window:${service}`;
    await this.redis.lpush(key, latencyMs);
    await this.redis.ltrim(key, 0, this.windowSize - 1);
  }

  async getWindow(service) {
    const values = await this.redis.lrange(`latency_window:${service}`, 0, -1);
    return values.map(Number);
  }

  computeStats(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    return { mean, stddev };
  }

  async detect(service, latencyMs) {
    await this.addReading(service, latencyMs);
    const window = await this.getWindow(service);
    if (window.length < 10) return null; // not enough data yet

    const { mean, stddev } = this.computeStats(window);
    if (latencyMs > mean + this.threshold * stddev) {
      await this.db.query(
        `INSERT INTO anomalies (service, latency_ms, baseline_mean, baseline_stddev)
         VALUES ($1, $2, $3, $4)`,
        [service, latencyMs, mean, stddev]
      );
      return { service, latencyMs, baselineMean: mean, baselineStddev: stddev };
    }
    return null;
  }
}

module.exports = AnomalyDetector;
