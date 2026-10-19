import {digest,type PosPayment} from '@/lib/paratika/gateway';
import {posAdmin} from '@/lib/paratika/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const state=new URL(req.url).searchParams.get('anahtar')||'';
 if(!/^[0-9a-f]{64}$/.test(state))return new Response('Geçersiz ödeme bağlantısı.',{status:400});
 const {data,error}=await posAdmin().from('paratika_payments').select('status,amount_minor,mode').eq('callback_hash',digest(state)).maybeSingle();
 if(error||!data)return new Response('Ödeme kaydı bulunamadı.',{status:404});
 const p=data as Pick<PosPayment,'status'|'amount_minor'|'mode'>;
 const message=p.status==='paid'?'Ödemeniz doğrulandı.':p.status==='failed'?'Onaylanmış tahsilat bulunamadı.':'Ödemenizin sonucu kontrol ediliyor. Yeniden ödeme yapmadan Niba Tarım ile görüşün.';
 const amount=(Number(p.amount_minor)/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
 // A standalone response avoids advertising/analytics scripts receiving the bearer link.
 return new Response(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Niba Tarım | Ödeme sonucu</title></head><body><main><h1>Niba Tarım</h1><h2>${message}</h2><p>${amount}</p>${p.mode==='test'?'<p>Bu bir test işlemidir; gerçek tahsilat değildir.</p>':''}<p>Sonucu tekrar görmek için sayfayı yenileyebilirsiniz.</p><a href="/iletisim">İletişim</a></main></body></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
}
