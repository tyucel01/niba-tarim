import { NextResponse } from 'next/server';
import { parseTcmbRates } from '@/lib/market/rates';
export const runtime = 'nodejs';
export const revalidate = 3600;
export async function GET() {
  try {
    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Kur kaynağına ulaşılamadı.');
    const rates = parseTcmbRates(await response.text());
    return NextResponse.json({ success: true, ...rates }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Döviz kurları şu anda alınamıyor.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
