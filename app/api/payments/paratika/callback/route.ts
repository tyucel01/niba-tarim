import {NextResponse} from 'next/server';
import {digest,posConfig,callbackNotice,type PosPayment} from '@/lib/paratika/gateway';
import {posAdmin,reconcilePayment} from '@/lib/paratika/server';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
// Only bounded, allowlisted callback codes may be recorded as informational hints. Payment proof always comes from QUERYTRANSACTION.
async function handle(req:Request){
 const state=new URL(req.url).searchParams.get('state')||'';
 if(!/^[0-9a-f]{64}$/.test(state))return new Response('Geçersiz ödeme dönüşü.',{status:400});
 const db=posAdmin();const {data,error}=await db.from('paratika_payments').select('*').eq('callback_hash',digest(state)).maybeSingle();
 if(error||!data)return new Response('Ödeme kaydı bulunamadı.',{status:404});
 let notice:string|null=null;
 if(req.method==='POST'&&req.headers.get('content-type')?.includes('application/x-www-form-urlencoded')){
  const reader=req.body?.getReader();if(reader){let size=0;const chunks:Uint8Array[]=[];try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16384){await reader.cancel();break;}chunks.push(part.value);}if(size<=16384){const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}notice=callbackNotice(new URLSearchParams(new TextDecoder().decode(bytes)));}}catch{/* Ignore malformed callbacks; query remains authoritative. */}}
 }
 try{await reconcilePayment(db,data as PosPayment);}catch{/* Pending remains pending; background/manual queries can recover it. */}
 if(notice)await db.from('paratika_payments').update({check_note:notice}).eq('id',data.id).in('status',['creating','pending','review']);
 const response=NextResponse.redirect(`${posConfig().origin}/odeme/sonuc?anahtar=${state}`,303);
 response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;
}
export const POST=handle;export const GET=handle;
