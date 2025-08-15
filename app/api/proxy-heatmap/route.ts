import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return new NextResponse('Missing url', { status: 400 });

  try {
    const headers: Record<string,string> = {};
    const apiKey = process.env.HEATMAP_API_KEY;
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const r = await fetch(url, { headers, cache: 'no-store' });
    if (!r.ok) {
      return new NextResponse(`Upstream error: ${r.status}`, { status: 502 });
    }
    const contentType = r.headers.get('content-type') || 'image/png';
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'no-store'
      }
    });
  } catch (e) {
    return new NextResponse('Proxy error', { status: 500 });
  }
}
