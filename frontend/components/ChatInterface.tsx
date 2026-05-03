'use client';

import {
  FormEvent,
  Fragment,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type Role = 'user' | 'assistant';

type Msg = { role: Role; content: string; kind?: 'answer' | 'error' };

const SUGGESTIONS = [
  'Why did the payment journey fail in the last 30 minutes?',
  'Which service has the highest latency right now?',
  'Are there any active anomalies I should know about?',
];

/** Turn `**segments**` from the model into bold without adding dependencies. */
function renderWithBold(text: string): React.ReactNode[] {
  const re = /\*\*([^*]+)\*\*/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    nodes.push(
      <strong
        key={`b-${k++}`}
        className="font-semibold text-[#f4eee6] underline decoration-[#C7B7A3]/50 decoration-1 underline-offset-2"
      >
        {m[1]}
      </strong>
    );
    last = m.index + m[0].length;
  }
  nodes.push(text.slice(last));
  return nodes;
}

function isLikelyPipeTable(block: string): boolean {
  const lines = block.trim().split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;
  const pipeLines = lines.filter((l) => {
    const t = l.trim();
    return t.includes('|') && (t.startsWith('|') || t.endsWith('|'));
  });
  return pipeLines.length >= 2;
}

function AssistantBody({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n\n+/);
  return (
    <div className="space-y-3 text-[0.9375rem] leading-relaxed text-[#E8D8C4]/95">
      {paragraphs.map((block, i) =>
        isLikelyPipeTable(block) ? (
          <div
            key={i}
            className="logiq-scroll -mx-1 max-w-full overflow-x-auto rounded-md border border-[#6D2932]/60 bg-[#2a0c10]/85 py-2 pl-2 pr-1"
          >
            <pre className="m-0 min-w-min whitespace-pre font-mono text-[11px] leading-snug text-[#E8D8C4]/95">
              {block.trimEnd()}
            </pre>
          </div>
        ) : (
          <p key={i} className="m-0">
            {block.split('\n').map((line, li, lines) => (
              <Fragment key={li}>
                {renderWithBold(line)}
                {li < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        )
      )}
    </div>
  );
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || data.error) {
        const errText =
          data.error ??
          (res.ok ? 'No answer returned.' : `Request failed (${res.status}).`);
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: errText, kind: 'error' },
        ]);
        return;
      }
      const content = data.answer ?? 'No answer returned.';
      setMessages((m) => [...m, { role: 'assistant', content, kind: 'answer' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: msg, kind: 'error' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <section className="rounded-xl border border-[#6D2932] bg-[#561C24] p-5 text-[#E8D8C4] shadow-lg ring-1 ring-black/5">
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-[#E8D8C4] md:text-3xl">
          Ask LogIQ
        </h2>
        <p className="mt-1.5 text-sm text-[#C7B7A3]">
          Answers use live metrics, logs, and anomalies from your collector.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            className="max-w-full rounded-full border border-[#8a5a62] bg-[#6D2932]/90 px-3.5 py-2 text-left text-xs font-medium leading-snug text-[#E8D8C4] shadow-sm transition hover:border-[#C7B7A3] hover:bg-[#6D2932] disabled:cursor-not-allowed disabled:opacity-45 sm:max-w-[280px]"
            onClick={() => void send(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="logiq-scroll mb-4 max-h-[min(420px,55vh)] space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-[#451820] bg-gradient-to-b from-[#2f1015] to-[#261014] p-4 shadow-inner"
      >
        {messages.length === 0 && !loading && (
          <div className="rounded-lg border border-dashed border-[#6D2932]/80 bg-[#561C24]/30 px-4 py-8 text-center">
            <p className="text-sm font-medium text-[#C7B7A3]">
              Start a conversation
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#C7B7A3]/80">
              Ask about failures, latency, services, or anomalies. Responses are
              grounded in your ingested data.
            </p>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={`${i}-user`}
              className="ml-auto flex max-w-[min(100%,28rem)] flex-col items-end"
            >
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#C7B7A3]/90">
                You
              </span>
              <div className="rounded-2xl rounded-br-md border border-[#8a5a62]/60 bg-[#6D2932] px-4 py-3 text-sm leading-relaxed text-[#E8D8C4] shadow-md">
                <p className="m-0 whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ) : m.kind === 'error' ? (
            <div
              key={`${i}-asst`}
              className="mr-auto flex max-w-[min(100%,32rem)] flex-col items-start"
            >
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#e8a8a8]">
                LogIQ
              </span>
              <div
                className="rounded-2xl rounded-bl-md border border-[#a85c5c]/70 bg-[#4a1518]/90 px-4 py-3 text-sm leading-relaxed text-[#F5C2C2] shadow-md"
                role="alert"
              >
                <p className="m-0 whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ) : (
            <div
              key={`${i}-asst`}
              className="mr-auto flex max-w-[min(100%,36rem)] flex-col items-start"
            >
              <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#C7B7A3]">
                LogIQ
              </span>
              <div className="relative rounded-2xl rounded-bl-md border border-[#6D2932] bg-[#561C24] px-4 pb-4 pt-3 shadow-md ring-1 ring-[#C7B7A3]/10">
                <div
                  className="pointer-events-none absolute left-0 top-3 bottom-3 w-1 rounded-full bg-[#C7B7A3]/40"
                  aria-hidden
                />
                <div className="pl-3 pr-1">
                  <AssistantBody text={m.content} />
                </div>
              </div>
            </div>
          )
        )}

        {loading && (
          <div className="mr-auto flex max-w-[min(100%,20rem)] flex-col items-start">
            <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#C7B7A3]">
              LogIQ
            </span>
            <div className="flex items-center gap-3 rounded-2xl rounded-bl-md border border-[#6D2932] bg-[#561C24]/80 px-4 py-3 text-sm text-[#C7B7A3]">
              <span
                className="flex gap-1"
                aria-hidden
              >
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#C7B7A3] [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#C7B7A3] [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#C7B7A3]" />
              </span>
              <span>Thinking with your data…</span>
              <span className="sr-only">Loading</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          rows={2}
          className="min-h-[48px] flex-1 resize-y rounded-lg border border-[#561C24] bg-[#6D2932] px-3.5 py-2.5 font-sans text-sm leading-snug text-[#E8D8C4] shadow-inner outline-none placeholder:text-[#C7B7A3]/70 ring-[#C7B7A3]/30 transition focus:border-[#C7B7A3] focus:ring-2"
          placeholder="Ask anything about your system… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 rounded-lg border-2 border-[#561C24] bg-[#E8D8C4] px-6 py-2.5 text-sm font-bold text-[#561C24] shadow-md ring-2 ring-[#C7B7A3]/40 transition hover:bg-[#f2e8dc] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}
