import {timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {posAdmin,reconcilePayment} from '@/lib/paratika/server';
import {type PosPayment} from '@/lib/paratika/gateway';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:Request){
 const expected=process.env.CRON_SECRET||'',token=req.headers.get('authorization')?.replace(/^Bearer /i,'')||'';
 if(expected.length<32||Buffer.byteLength(token)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return NextResponse.json({error:'Yetkisiz.'},{status:401});
 const db=posAdmin();
 // Includes paid-but-not-posted records so a missing callback/ledger write can recover.
 const {data,error}=await db.from('paratika_payments').select('*').or('status.in.(creating,ready,pending,review),and(status.eq.paid,parasut_state.eq.pending)').order('last_checked_at',{ascending:true,nullsFirst:true}).order('created_at',{ascending:true}).limit(4);
 if(error)return NextResponse.json({error:'Ödemeler okunamadı.'},{status:503});
 let checked=0,pending=0;
 for(const item of data||[]){try{const result=await reconcilePayment(db,item as PosPayment);checked++;if(result.status!=='paid')pending++;}catch{pending++;await db.from('paratika_payments').update({last_checked_at:new Date().toISOString()}).eq('id',item.id);}}
 return NextResponse.json({ok:true,checked,pending},{headers:{'Cache-Control':'no-store'}});
}
