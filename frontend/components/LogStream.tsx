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

/** Level colors on dark panel — palette + readable accents */
const levelColor: Record<string, string> = {
  INFO: '#C7B7A3',
  WARN: '#E8D8C4',
  ERROR: '#F5C2C2',
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  /** Scroll only the log panel — avoid scrollIntoView (it pulls the whole page). */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <section className="rounded-lg border border-[#6D2932] bg-[#561C24] p-4 text-[#E8D8C4] shadow-md">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#C7B7A3]">
        Live logs
      </h2>
      <div
        ref={scrollRef}
        className="logiq-scroll max-h-[420px] overflow-y-auto overflow-x-hidden rounded border border-[#6D2932] bg-[#6D2932] p-3 font-mono text-sm leading-relaxed overscroll-contain"
      >
        {lines.length === 0 ? (
          <p className="text-[#C7B7A3]">
            Waiting for events… (collector WebSocket on :4001)
          </p>
        ) : (
          lines.map((row, i) => (
            <div
              key={`${row.id ?? i}-${row.timestamp ?? ''}-${i}`}
              style={{
                color: levelColor[row.level ?? ''] ?? '#E8D8C4',
              }}
            >
              {formatLine(row)}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
