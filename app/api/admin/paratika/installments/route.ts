import {NextResponse} from 'next/server';
import {posAdmin,posAuth} from '@/lib/paratika/server';
import {posConfig,posRequest,installmentOptions} from '@/lib/paratika/gateway';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){
 const auth=await posAuth(req,posAdmin());if(auth.error)return auth.error;
 try{
  const raw=await req.text();if(raw.length>150)throw Error('İstek geçersiz.');
  const body=JSON.parse(raw);if(Object.keys(body).some(k=>!['merchant','bin'].includes(k))||typeof body.bin!=='string'||!/^\d{8}$/.test(body.bin)||typeof body.merchant!=='string')throw Error('Kartın yalnız ilk 8 hanesi gönderilmeli.');
  const c=posConfig(process.env,body.merchant);if(!c.configured)throw Error('Seçilen üye iş yerinin API ayarları henüz eklenmedi.');
  const options=installmentOptions(await posRequest('QUERYINSTALLMENT',{BIN:body.bin},fetch,body.merchant),body.merchant);
  return NextResponse.json({ok:true,options},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Taksit seçenekleri alınamadı. Üye iş yeri bağlantısını kontrol edin.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
