import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createCardLedgerTransaction,paratikaLedgerAccount } from "@/lib/parasut/card-ledger";
import { checkoutUrl,digest,posConfig,posRequest,sessionParams,toMinor,verifyQuery,installmentOptions,requireSessionToken,PaymentSessionError,type PosPayment } from "./gateway";
export function posAdmin() {return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});}
export type PosDb = ReturnType<typeof posAdmin>;
export async function posAuth(req:Request,db:PosDb) {
  const bearer=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!bearer)return {error:NextResponse.json({error:'Oturum açmanız gerekiyor.'},{status:401})};
  const {data,error}=await db.auth.getUser(bearer);
  if(error||!data.user||data.user.is_anonymous)return {error:NextResponse.json({error:'Oturum geçersiz.'},{status:401})};
  const emails=(process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const phones=(process.env.ADMIN_PHONES||'').split(',').map(x=>x.replace(/\s/g,'')).filter(Boolean);
  if(!(emails.includes((data.user.email||'').toLowerCase())||phones.includes(data.user.phone||'')))return {error:NextResponse.json({error:'Sanal POS için yönetici yetkisi gerekiyor.'},{status:403})};
  return {user:data.user};
}
function text(value:unknown,max:number,label:string){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\x00-\x1f]/.test(value))throw new Error(`${label} geçersiz.`);return value.trim();}
export function paymentInput(body:any){
  if(!body||Object.keys(body).some(k=>!['key','customerId','customerName','customerEmail','amount','description','merchant','installments','paymentSystem','bin'].includes(k)))throw new Error('Ödeme alanları geçersiz.');
  const key=text(body.key,36,'İşlem anahtarı');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key))throw new Error('İşlem anahtarı geçersiz.');
  const customerId=text(body.customerId,128,'Cari');if(!/^\d+$/.test(customerId))throw new Error('Paraşüt cari kimliği geçersiz.');
  const customerName=text(body.customerName,128,'Müşteri adı'),customerEmail=body.customerEmail?text(body.customerEmail,64,'E-posta'):'';
  if(customerEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))throw new Error('Müşteri e-posta adresi geçersiz.');
  const description=body.description?text(body.description,250,'Açıklama'):'';
  const merchant=text(body.merchant,8,'Üye iş yeri');posConfig(process.env,merchant);
  const installments=Number(body.installments);if(!Number.isInteger(installments)||installments<1||installments>36)throw new Error('Taksit geçersiz.');
  const paymentSystem=text(body.paymentSystem,128,'Ödeme sistemi');
  const bin=text(body.bin,8,'Kart ön eki');if(!/^\d{8}$/.test(bin))throw new Error('Kart ön eki geçersiz.');
  return {key,customerId,customerName,customerEmail,description,merchant,installments,paymentSystem,bin,amountMinor:toMinor(body.amount)};
}
export async function createPayment(db:PosDb,input:ReturnType<typeof paymentInput>,userId:string){
  const config=posConfig(process.env,input.merchant);if(!config.enabled||!config.configured)throw new Error('Paratika tahsilat ayarları tamamlanmadı veya tahsilat kapalı.');
  if(config.mode==='live'&&!paratikaLedgerAccount(input.merchant))throw new Error('Paratika için Paraşüt bloke hesabı tanımlanmalı.');
  const options=installmentOptions(await posRequest('QUERYINSTALLMENT',{BIN:input.bin},fetch,input.merchant),input.merchant);
  if(!options.some(x=>x.count===input.installments&&x.system===input.paymentSystem))throw new Error('Seçilen taksit bu kart için kullanılamıyor. Seçenekleri yenileyin.');
  const state=randomBytes(32).toString('hex');
  const {data,error}=await db.rpc('reserve_paratika_payment',{p_key:input.key,p_customer:input.customerId,p_name:input.customerName,p_email:input.customerEmail,p_minor:input.amountMinor,p_mode:config.mode,p_merchant:config.merchant,p_hash:digest(state),p_creator:userId,p_description:input.description,p_installments:input.installments,p_system:input.paymentSystem});
  if(error||!data?.payment)throw new Error('Tahsilat kaydı ayrılamadı. Aynı işlem anahtarıyla tekrar kontrol edin.');
  const payment=data.payment as PosPayment;
  if(!data.created)return {payment:publicPayment(payment),checkout:null};
  try{
    const response=await posRequest('SESSIONTOKEN',sessionParams(payment,state,config.origin),fetch,input.merchant);
    const sessionToken=requireSessionToken(response);
    const {data:ready,error:writeError}=await db.from('paratika_payments').update({session_token:sessionToken,status:'pending'}).eq('id',payment.id).eq('status','creating').select('*').maybeSingle();
    if(writeError)throw new PaymentSessionError('SESSION_STORAGE',false,'Oturum kaydı doğrulanamadı. Yeni tahsilat başlatmayın.');
    if(!ready)return {payment:publicPayment(payment),checkout:null};
    return {payment:publicPayment(ready as PosPayment),checkout:checkoutUrl(ready as PosPayment)};
  }catch(error){
    const known=error instanceof PaymentSessionError;
    const message=known?error.message:'Ödeme oturumu yanıtı veya kayıt işlemi doğrulanamadı (SESSION_NETWORK_OR_STORAGE). İşlem listeden kontrol edilmeli; tekrar tahsilat başlatmayın.';
    const status=known&&error.rejected?'failed':'review';
    await db.from('paratika_payments').update({status,check_note:message}).eq('id',payment.id).eq('status','creating');
    console.warn('paratika_session_setup',{paymentId:payment.id,code:known?error.code:'SESSION_NETWORK_OR_STORAGE',status});
    throw new Error(message);
  }
}
export function publicPayment(p:PosPayment){return {id:p.id,reference:p.merchant_payment_id,customerName:p.customer_name,amountMinor:Number(p.amount_minor),currency:p.currency,status:p.status,mode:p.mode,createdAt:p.created_at,expiresAt:p.expires_at,parasutState:p.parasut_state,blockDays:3,merchant:p.merchant,installments:p.installment_count||1,notice:p.check_note||null};}
export async function syncLedger(db:PosDb,payment:PosPayment){
  if(payment.status!=='paid'||payment.mode!=='live'||payment.parasut_state!=='pending')return;
  const account=paratikaLedgerAccount(payment.merchant);
  if(!account)return; // Leave pending until the dedicated blocked-funds account is configured.
  const {data:claim,error}=await db.rpc('claim_paratika_ledger',{p_id:payment.id});
  if(error||!claim)return;
  try{
    const result=await createCardLedgerTransaction({contactId:claim.customer_id,transactionType:'collection',date:claim.paid_date,amount:Number(claim.amount_minor)/100,description:`Paratika ${claim.merchant_payment_id}`,accountId:account});
    const {error:finishError}=await db.rpc('finish_paratika_ledger',{p_id:payment.id,p_transaction:String(result.data.id)});
    if(finishError)throw new Error('Muhasebe kayıt teyidi alınamadı.');
  }catch{
    // Never automatically retry an external ledger write with an uncertain outcome.
    await db.from('paratika_payments').update({parasut_state:'review'}).eq('id',payment.id).eq('parasut_state','posting');
  }
}
export async function reconcilePayment(db:PosDb,payment:PosPayment){
  const config=posConfig(process.env,payment.merchant);if(payment.mode!==config.mode||payment.merchant!==config.merchant)throw new Error('Ödeme ortamı/üye iş yeri ayarı uyuşmuyor.');
  if(payment.status!=='paid' && payment.last_checked_at && Date.now()-Date.parse(payment.last_checked_at)<30000) return payment;
  if(payment.status!=='paid'){
    let result=verifyQuery(payment,await posRequest('QUERYTRANSACTION',{MERCHANTPAYMENTID:payment.merchant_payment_id,FORGROUP:'NO',OFFSET:'0',LIMIT:'100'},fetch,payment.merchant));
    if(result.status==='failed' && Date.parse(payment.expires_at)+120000>Date.now()) result={status:'pending',reason:'Oturum açık; sonuç kesinleşmeden yeni tahsilat başlatmayın.'};
    const {data,error}=await db.rpc('record_paratika_check',{p_id:payment.id,p_status:result.status,p_transaction:result.transactionId||null,p_note:result.reason,p_paid_date:result.paidDate||null});
    if(error||!data)throw new Error('Ödeme sorgu sonucu kaydedilemedi.');
    payment=data as PosPayment;
  }
  if(payment.status==='paid') await db.from('paratika_payments').update({last_checked_at:new Date().toISOString()}).eq('id',payment.id);
  await syncLedger(db,payment);
  const {data,error}=await db.from('paratika_payments').select('*').eq('id',payment.id).single();
  if(error||!data)throw new Error('Tahsilat durumu okunamadı.');
  return data as PosPayment;
}
