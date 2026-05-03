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

const SERVICE_PALETTE: Record<string, string> = {
  'auth-service': '#3B82F6',
  'fraud-service': '#A855F7',
  'payment-service': '#3ECF8E',
  'notification-service': '#F472B6',
};

function barColor(service: string): string {
  return SERVICE_PALETTE[service] ?? '#64748b';
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
    <section className="rounded-lg border border-[#1a1a1a] bg-[#111111] p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Trace timeline
      </h2>
      <form onSubmit={onSubmit} className="mb-4 flex flex-wrap gap-2">
        <input
          className="min-w-[240px] flex-1 rounded border border-[#1a1a1a] bg-[#0a0a0a] px-3 py-2 font-mono text-sm outline-none ring-[#3ECF8E] focus:ring-2"
          placeholder="traceId"
          value={traceId}
          onChange={(e) => setTraceId(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[#3ECF8E]/90 px-4 py-2 text-sm font-medium text-black hover:bg-[#3ECF8E] disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load trace'}
        </button>
      </form>

      {error && (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {spans && spans.length > 0 && (
        <div className="space-y-3">
          <div className="flex h-14 w-full overflow-hidden rounded border border-[#1a1a1a] bg-[#0a0a0a]">
            {spans.map((span, idx) => {
              const lat = span.latency_ms ?? 0;
              const pct = totalLatency > 0 ? (lat / totalLatency) * 100 : 100 / spans.length;
              const err = span.level === 'ERROR';
              return (
                <div
                  key={`${span.span_id ?? idx}-${idx}`}
                  className="relative flex min-w-[2rem] flex-col justify-end border-r border-black/30 px-1 pb-1 pt-2 text-[10px] text-white/90 last:border-r-0"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: barColor(span.service ?? ''),
                    boxShadow: err ? 'inset 0 0 0 2px #EF4444' : undefined,
                  }}
                  title={`${span.service} · ${span.latency_ms}ms`}
                >
                  <span className="truncate font-medium">{span.service}</span>
                  <span className="truncate opacity-80">{span.span_id}</span>
                  <span className="opacity-90">{span.latency_ms}ms</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-neutral-500">
            Bar width ∝ latency. Red inset = ERROR span.
          </p>
        </div>
      )}

      {spans && spans.length === 0 && (
        <p className="text-sm text-neutral-500">No spans for this trace.</p>
      )}
    </section>
  );
}
