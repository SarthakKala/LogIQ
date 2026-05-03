'use client';

import { useEffect, useRef, useState } from 'react';

type LogRow = {
  id?: number;
  timestamp?: string;
  service?: string;
  level?: string;
  message?: string;
  latency_ms?: number | null;
};

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4001';

const levelColor: Record<string, string> = {
  INFO: '#3ECF8E',
  WARN: '#F59E0B',
  ERROR: '#EF4444',
};

function formatLine(row: LogRow): string {
  const ts = row.timestamp
    ? new Date(row.timestamp).toISOString()
    : '';
  const svc = row.service ?? '';
  const lvl = row.level ?? '';
  const msg = row.message ?? '';
  const ms = row.latency_ms != null ? String(row.latency_ms) : '';
  return `[${ts}] [${svc}] [${lvl}] ${msg} — ${ms}ms`;
}

export default function LogStream() {
  const [lines, setLines] = useState<LogRow[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (ev) => {
      try {
        const row = JSON.parse(ev.data as string) as LogRow;
        setLines((prev) => {
          const next = [...prev, row];
          return next.length > 200 ? next.slice(-200) : next;
        });
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => {};

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <section className="rounded-lg border border-[#1a1a1a] bg-[#111111] p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-400">
        Live logs
      </h2>
      <div className="max-h-[420px] overflow-y-auto rounded border border-[#1a1a1a] bg-black/40 p-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-neutral-600">
            Waiting for events… (collector WebSocket on :4001)
          </p>
        ) : (
          lines.map((row, i) => (
            <div
              key={`${row.id ?? i}-${row.timestamp ?? ''}-${i}`}
              style={{
                color: levelColor[row.level ?? ''] ?? '#94a3b8',
              }}
            >
              {formatLine(row)}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
