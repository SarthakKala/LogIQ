'use client';

import { FormEvent, useMemo, useState } from 'react';

const COLLECTOR =
  process.env.NEXT_PUBLIC_COLLECTOR_URL || 'http://localhost:4000';

type SpanRow = {
  trace_id?: string;
  span_id?: string | null;
  service?: string;
  level?: string;
  latency_ms?: number | null;
};

/** Light bar fills (palette) + dark text for contrast on dark chart panel */
const SERVICE_PALETTE: Record<string, string> = {
  'auth-service': '#E8D8C4',
  'fraud-service': '#C7B7A3',
  'payment-service': '#E8D8C4',
  'notification-service': '#E8D8C4',
};

function barColor(service: string): string {
  return SERVICE_PALETTE[service] ?? '#C7B7A3';
}

/** Rings distinguish services that share the same fill (palette-only). */
function barRing(service: string): string | undefined {
  if (service === 'payment-service') return '0 0 0 2px #6D2932';
  if (service === 'notification-service') return '0 0 0 2px #C7B7A3';
  return undefined;
}

export default function TraceView() {
  const [traceId, setTraceId] = useState('');
  const [spans, setSpans] = useState<SpanRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLatency = useMemo(
    () =>
      spans?.reduce((s, x) => s + (x.latency_ms ?? 0), 0) ||
      1,
    [spans]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const id = traceId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${COLLECTOR}/traces/${encodeURIComponent(id)}`);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `${res.status}`);
      }
      const data = (await res.json()) as SpanRow[];
      setSpans(Array.isArray(data) ? data : []);
    } catch (err) {
      setSpans(null);
      setError(err instanceof Error ? err.message : 'Failed to load trace');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-[#6D2932] bg-[#561C24] p-4 text-[#E8D8C4] shadow-md">
      <h2 className="mb-6 text-center text-2xl font-bold uppercase tracking-wide text-[#E8D8C4] md:text-3xl">
        Trace timeline
      </h2>
      <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          className="min-w-[240px] flex-1 rounded border border-[#561C24] bg-[#6D2932] px-3 py-2 font-mono text-sm text-[#E8D8C4] outline-none placeholder:text-[#C7B7A3]/80 ring-[#C7B7A3] focus:ring-2"
          placeholder="traceId"
          value={traceId}
          onChange={(e) => setTraceId(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border-2 border-[#561C24] bg-[#E8D8C4] px-5 py-2.5 text-sm font-bold text-[#561C24] shadow-md ring-2 ring-[#C7B7A3] transition hover:bg-[#f2e8dc] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load trace'}
        </button>
      </form>

      {error && (
        <p className="mb-3 text-sm text-[#F5C2C2]" role="alert">
          {error}
        </p>
      )}

      {spans && spans.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-3 rounded border border-[#561C24] bg-[#3d1419] p-3 shadow-inner">
            {spans.map((span, idx) => {
              const lat = span.latency_ms ?? 0;
              const pct =
                totalLatency > 0 ? (lat / totalLatency) * 100 : 100 / spans.length;
              const err = span.level === 'ERROR';
              const width = Math.max(pct, 10);
              const svc = span.service ?? '';
              const ring = !err ? barRing(svc) : undefined;
              return (
                <div key={`${span.span_id ?? idx}-${idx}`} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#E8D8C4]">
                    <span className="truncate font-medium">{span.service}</span>
                    <span className="truncate font-mono text-xs text-[#C7B7A3]">
                      {span.span_id}
                    </span>
                    <span className="font-mono text-[#E8D8C4]">{span.latency_ms}ms</span>
                  </div>
                  <div className="h-8 w-full rounded bg-[#561C24]/70">
                    <div
                      className="h-8 min-w-[4px] rounded"
                      style={{
                        width: `${width}%`,
                        backgroundColor: barColor(svc),
                        boxShadow: err
                          ? 'inset 0 0 0 2px #561C24'
                          : ring,
                      }}
                      title={`${span.service} · ${span.latency_ms}ms`}
                      aria-label={`${span.service}, ${span.latency_ms}ms`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[#C7B7A3]">
            Each row is one span. Bar width ∝ latency. Dark inset = ERROR span.
          </p>
        </div>
      )}

      {spans && spans.length === 0 && (
        <p className="text-sm text-[#C7B7A3]">No spans for this trace.</p>
      )}
    </section>
  );
}
