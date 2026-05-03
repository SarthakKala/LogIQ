'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const COLLECTOR =
  process.env.NEXT_PUBLIC_COLLECTOR_URL || 'http://localhost:4000';

/** Keep dashboard light — full history stays in the DB. */
const ANOMALY_UI_LIMIT = 12;

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

function rowKey(a: AnomalyRow, idx: number): string {
  return String(a.id ?? `row-${idx}`);
}

export default function MetricsPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`${COLLECTOR}/metrics/summary`),
        fetch(`${COLLECTOR}/anomalies?limit=${ANOMALY_UI_LIMIT}`),
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

  const visibleRows = useMemo(
    () =>
      anomalies
        .map((a, idx) => ({ a, idx, key: rowKey(a, idx) }))
        .filter(({ key }) => !dismissed.has(key)),
    [anomalies, dismissed]
  );

  function dismissAllVisible() {
    setDismissed((prev) => {
          const next = new Set(prev);
          for (const { key } of visibleRows) {
            next.add(key);
          }
          return next;
        });
  }

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

      <details className="rounded-lg border border-[#6D2932] bg-[#561C24] text-[#E8D8C4] shadow-md">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold uppercase tracking-wide text-[#C7B7A3]">
            Recent anomalies
            {visibleRows.length > 0 ? (
              <span className="ml-2 rounded-full bg-[#6D2932] px-2 py-0.5 text-xs font-bold text-[#E8D8C4]">
                {visibleRows.length}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-[#C7B7A3]">
            Last {ANOMALY_UI_LIMIT} · expand to view
          </span>
        </summary>
        <div className="border-t border-[#6D2932] px-3 pb-3 pt-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#C7B7A3]">
              Latency spikes vs rolling baseline. Hidden items stay dismissed until
              refresh.
            </p>
            {visibleRows.length > 0 ? (
              <button
                type="button"
                className="rounded border border-[#C7B7A3] bg-[#6D2932] px-2 py-1 text-xs font-semibold text-[#E8D8C4] hover:bg-[#561C24]"
                onClick={dismissAllVisible}
              >
                Dismiss all
              </button>
            ) : null}
          </div>
          <div className="max-h-52 overflow-y-auto overscroll-contain rounded border border-[#561C24] bg-[#3d1419]">
            {visibleRows.length === 0 ? (
              <p className="p-3 text-sm text-[#C7B7A3]">No active anomalies in view.</p>
            ) : (
              <ul className="divide-y divide-[#561C24]/80">
                {visibleRows.map(({ a, key }) => {
                  const svc = a.service ?? 'unknown';
                  const lat = a.latency_ms ?? 0;
                  const mean = a.baseline_mean ?? 0;
                  const sd = a.baseline_stddev ?? 0;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-2 px-3 py-2.5 text-xs text-[#F5C2C2]"
                      role="status"
                    >
                      <span className="shrink-0" aria-hidden>
                        ⚠
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-[#E8D8C4]">{svc}</span>
                        <span className="text-[#C7B7A3]"> · </span>
                        <span>{lat}ms</span>
                        <span className="text-[#C7B7A3]"> · baseline </span>
                        <span>
                          μ {mean.toFixed(0)}ms ± {sd.toFixed(0)}ms
                        </span>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded border border-[#6D2932] bg-[#561C24] px-2 py-1 text-[11px] font-bold text-[#E8D8C4] hover:bg-[#6D2932]"
                        aria-label={`Dismiss anomaly for ${svc}`}
                        onClick={() =>
                          setDismissed((prev) => new Set(prev).add(key))
                        }
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}
