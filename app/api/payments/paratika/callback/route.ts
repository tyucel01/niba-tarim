import {NextResponse} from 'next/server';
import {digest,posConfig,type PosPayment} from '@/lib/paratika/gateway';
import {posAdmin,reconcilePayment} from '@/lib/paratika/server';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
// Posted response codes, amounts and transaction IDs are untrusted and intentionally ignored.
async function handle(req:Request){
 const state=new URL(req.url).searchParams.get('state')||'';
 if(!/^[0-9a-f]{64}$/.test(state))return new Response('Geçersiz ödeme dönüşü.',{status:400});
 const db=posAdmin();const {data,error}=await db.from('paratika_payments').select('*').eq('callback_hash',digest(state)).maybeSingle();
 if(error||!data)return new Response('Ödeme kaydı bulunamadı.',{status:404});
 try{await reconcilePayment(db,data as PosPayment);}catch{/* Pending remains pending; background/manual queries can recover it. */}
 const response=NextResponse.redirect(`${posConfig().origin}/odeme/sonuc?anahtar=${state}`,303);
 response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
export const POST=handle;export const GET=handle;
