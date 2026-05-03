import ChatInterface from '@/components/ChatInterface';
import LogStream from '@/components/LogStream';
import MetricsPanel from '@/components/MetricsPanel';
import TraceView from '@/components/TraceView';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 p-6">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#561C24] md:text-5xl">
          LogIQ
        </h1>
        <p className="mt-3 text-base text-[#6D2932]">
          Metrics, live logs, traces, and grounded chat
        </p>
      </header>
      <MetricsPanel />
      <LogStream />
      <TraceView />
      <ChatInterface />
    </main>
  );
}
