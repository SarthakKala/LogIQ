'use client';

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

type Role = 'user' | 'assistant';

type Msg = { role: Role; content: string };

const SUGGESTIONS = [
  'Why did the payment journey fail in the last 30 minutes?',
  'Which service has the highest latency right now?',
  'Are there any active anomalies I should know about?',
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      const content =
        data.answer ??
        data.error ??
        (res.ok ? 'No answer returned.' : `Error (${res.status})`);
      setMessages((m) => [...m, { role: 'assistant', content }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed';
      setMessages((m) => [...m, { role: 'assistant', content: msg }]);
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
    <section className="rounded-lg border border-[#6D2932] bg-[#561C24] p-4 text-[#E8D8C4] shadow-md">
      <h2 className="mb-4 text-center text-2xl font-bold uppercase tracking-wide text-[#E8D8C4] md:text-3xl">
        Ask LogIQ
      </h2>

      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            className="rounded-full border border-[#C7B7A3] bg-[#6D2932] px-3 py-1.5 text-left text-xs font-medium text-[#E8D8C4] hover:bg-[#561C24] disabled:opacity-50"
            onClick={() => void send(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-3 max-h-[360px] space-y-3 overflow-y-auto rounded border border-[#561C24] bg-[#3d1419] p-3">
        {messages.length === 0 && !loading && (
          <p className="text-sm text-[#C7B7A3]">
            Ask a question about logs, latency, or anomalies. Data is grounded in
            your collector.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={
              m.role === 'user'
                ? 'ml-6 rounded-lg bg-[#6D2932] px-3 py-2 text-sm text-[#E8D8C4]'
                : 'mr-6 rounded-lg border border-[#6D2932] bg-[#561C24] px-3 py-2 text-sm text-[#C7B7A3]'
            }
          >
            <p className="text-[10px] font-bold uppercase text-[#C7B7A3]">
              {m.role}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="mr-6 rounded-lg border border-[#6D2932] bg-[#561C24] px-3 py-2 text-sm text-[#E8D8C4]">
            <span className="inline-block animate-pulse font-mono">▍</span>
            <span className="sr-only">Loading</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <textarea
          rows={2}
          className="min-h-[44px] flex-1 resize-y rounded border border-[#561C24] bg-[#6D2932] px-3 py-2 font-sans text-sm text-[#E8D8C4] outline-none placeholder:text-[#C7B7A3]/80 ring-[#C7B7A3] focus:ring-2"
          placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-md border-2 border-[#561C24] bg-[#E8D8C4] px-5 py-2.5 text-sm font-bold text-[#561C24] shadow-md ring-2 ring-[#C7B7A3] transition hover:bg-[#f2e8dc] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 sm:self-end"
        >
          Send
        </button>
      </form>
    </section>
  );
}
