import {NextResponse} from 'next/server';
import {posAdmin,posAuth} from '@/lib/paratika/server';
import {posConfig,posRequest} from '@/lib/paratika/gateway';
export const runtime='nodejs';export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 const auth=await posAuth(req,posAdmin());if(auth.error)return auth.error;
 try{
  const raw=await req.text();if(raw.length>80)return reply({error:'İstek geçersiz.'},400);
  const body=JSON.parse(raw);if(!body||Object.keys(body).some(k=>k!=='merchant')||typeof body.merchant!=='string')return reply({error:'Üye iş yeri seçilmeli.'},400);
  const c=posConfig({...process.env,PARATIKA_MODE:'live'},body.merchant);
  if(!c.configured)return reply({error:'Bu test yayınının Preview ortamında seçilen hesabın API kullanıcı adı/şifresi bulunamadı. Vercel ortam kapsamını kontrol edin.'},503);
  // Read-only merchant configuration query. Never creates a payment session or charge.
  const data=await posRequest('QUERYINSTALLMENT',{},fetch,body.merchant,'live');
  if(data.responseCode!=='00')return reply({error:'Paratika API erişimini onaylamadı. API kullanıcı yetkisi ve üye iş yeri eşleşmesini kontrol edin.'},502);
  return reply({ok:true,merchant:body.merchant,message:`${body.merchant} canlı API bağlantısı doğrulandı. Ödeme oturumu veya tahsilat oluşturulmadı.`});
 }catch{return reply({error:'Paratika bağlantısı doğrulanamadı. Gerçek tahsilat yapılmadı.'},503);}
}
