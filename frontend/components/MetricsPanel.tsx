'use client';

import { useCallback, useEffect, useState } from 'react';

const COLLECTOR =
  process.env.NEXT_PUBLIC_COLLECTOR_URL || 'http://localhost:4000';

type Summary = {
  totalJourneys: number;
  successRate: number;
  avgLatency: number;
  topErrorService: string | null;
};

type AnomalyRow = {
  id?: number;
  service?: string;
  latency_ms?: number | null;
  baseline_mean?: number | null;
  baseline_stddev?: number | null;
};

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-[#6D2932] bg-[#561C24] p-4 text-[#E8D8C4] shadow-md">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#C7B7A3]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function MetricsPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${COLLECTOR}/metrics/summary`),
        fetch(`${COLLECTOR}/anomalies`),
      ]);
      if (sRes.ok) {
        const s = (await sRes.json()) as Summary;
        setSummary(s);
      }
      if (aRes.ok) {
        const a = (await aRes.json()) as AnomalyRow[];
        setAnomalies(Array.isArray(a) ? a : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  const successPct = summary
    ? `${(summary.successRate * 100).toFixed(1)}%`
    : '—';

  return (
    <section className="space-y-4">
      <h2 className="text-center text-2xl font-bold uppercase tracking-wide text-[#561C24] md:text-3xl">
        Metrics
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total journeys"
          value={summary ? String(summary.totalJourneys) : '—'}
        />
        <StatCard label="Success rate" value={successPct} />
        <StatCard
          label="Avg latency (ms)"
          value={
            summary != null ? Math.round(summary.avgLatency).toString() : '—'
          }
        />
        <StatCard
          label="Top error service"
          value={summary?.topErrorService ?? '—'}
        />
      </div>

      <div className="space-y-2">
        {anomalies
          .map((a, idx) => ({ a, idx, key: String(a.id ?? `row-${idx}`) }))
          .filter(({ key }) => !dismissed.has(key))
          .map(({ a, key }) => {
            const svc = a.service ?? 'unknown';
            const lat = a.latency_ms ?? 0;
            const mean = a.baseline_mean ?? 0;
            const sd = a.baseline_stddev ?? 0;
            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#6D2932] bg-[#561C24] px-4 py-3 text-sm text-[#F5C2C2] shadow-md"
                role="status"
              >
                <p className="font-medium">
                  ⚠ Anomaly: {svc} — {lat}ms (baseline: {mean.toFixed(0)}ms ±{' '}
                  {sd.toFixed(0)}ms)
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded border border-[#C7B7A3] bg-[#6D2932] px-2 py-1 text-xs font-semibold text-[#E8D8C4] hover:bg-[#561C24]"
                  onClick={() =>
                    setDismissed((prev) => new Set(prev).add(key))
                  }
                >
                  Dismiss
                </button>
              </div>
            );
          })}
      </div>
    </section>
  );
}
