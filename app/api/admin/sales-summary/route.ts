import { NextResponse } from 'next/server';
import { authorizeWhatsApp, whatsappAdmin } from '@/lib/whatsapp/admin';
import { buildSalesSummary, istanbulDate, type SalesSummaryRow } from '@/lib/orders/sales-summary';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const headers={'Cache-Control':'no-store'};
  try {
    const db=whatsappAdmin();
    const denied=await authorizeWhatsApp(request,db);if(denied)return denied;
    const rows:SalesSummaryRow[]=[];
    // Read every page; Supabase's default row limit must not truncate annual totals.
    for(let start=0;;start+=1000) {
      const {data,error}=await db.from('siparisler').select('id,satisTarihi,teslimOlanTonaj,sevkDurumu,pesinSatisFiyati').order('id').range(start,start+999);
      if(error)throw new Error();
      rows.push(...(data || []));
      if(!data || data.length<1000)break;
    }
    return NextResponse.json({success:true,...buildSalesSummary(rows,istanbulDate(new Date()))},{headers});
  } catch {return NextResponse.json({success:false,error:'Satış özeti alınamadı. Tekrar deneyebilirsin.'},{status:503,headers});}
}
