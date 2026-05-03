import LogStream from '@/components/LogStream';
import TraceView from '@/components/TraceView';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl space-y-10 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#3ECF8E]">
          LogIQ
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Live log stream and trace timeline
        </p>
      </header>
      <LogStream />
      <TraceView />
    </main>
  );
}
