import { NextRequest, NextResponse } from 'next/server';

const COLLECTOR =
  process.env.COLLECTOR_URL ||
  process.env.NEXT_PUBLIC_COLLECTOR_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const question =
    typeof body === 'object' &&
    body !== null &&
    'question' in body &&
    typeof (body as { question: unknown }).question === 'string'
      ? (body as { question: string }).question.trim()
      : '';

  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${COLLECTOR.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text || 'Upstream error' };
    }

    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Proxy failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
