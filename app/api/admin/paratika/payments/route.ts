import { NextResponse } from 'next/server';
import { posAdmin,posAuth,paymentInput,createPayment,publicPayment,reconcilePayment } from '@/lib/paratika/server';
import {posConfig,MERCHANTS,type PosPayment} from '@/lib/paratika/gateway';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=120;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){
 const db=posAdmin(),auth=await posAuth(req,db);if(auth.error)return auth.error;
 try{const c=posConfig();const {data,error}=await db.from('paratika_payments').select('*').order('created_at',{ascending:false}).limit(30);
 if(error)return reply({error:'Sanal POS kayıtları hazır değil. Kurulum kontrol edilmeli.'},503);
 return reply({ok:true,configured:c.configured&&c.enabled,mode:c.mode,merchants:MERCHANTS.map(m=>({...m,configured:posConfig(process.env,m.id).configured&&posConfig(process.env,m.id).enabled})),payments:(data||[]).map(p=>publicPayment(p as PosPayment))});}catch{return reply({error:'Sanal POS yapılandırması kontrol edilmeli.'},503);}
}
export async function POST(req:Request){
 const db=posAdmin(),auth=await posAuth(req,db);if(auth.error)return auth.error;
 try{const raw=await req.text();if(raw.length>4000)return reply({error:'İstek çok büyük.'},413);
 const input=paymentInput(JSON.parse(raw));return reply({ok:true,...await createPayment(db,input,auth.user!.id)});
 }catch(error){return reply({error:error instanceof Error?error.message:'Tahsilat başlatılamadı.'},400);}
}
export async function PATCH(req:Request){
 const db=posAdmin(),auth=await posAuth(req,db);if(auth.error)return auth.error;
 try{const raw=await req.text();if(raw.length>200)return reply({error:'İstek çok büyük.'},413);const {id}=JSON.parse(raw);
 if(typeof id!=='string'||! /^[0-9a-f-]{36}$/i.test(id))return reply({error:'Tahsilat kimliği geçersiz.'},400);
 const {data,error}=await db.from('paratika_payments').select('*').eq('id',id).single();if(error||!data)return reply({error:'Tahsilat bulunamadı.'},404);
 return reply({ok:true,payment:publicPayment(await reconcilePayment(db,data as PosPayment))});
 }catch{return reply({error:'Sonuç doğrulanamadı. Yeni tahsilat başlatmadan yeniden kontrol edin.'},503);}
}
