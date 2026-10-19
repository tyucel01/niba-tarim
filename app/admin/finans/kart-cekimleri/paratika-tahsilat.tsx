'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {usePanelDialog} from '@/app/admin/ui/panel-dialog';
type Contact={id:string;name:string;email?:string};
type Payment={id:string;reference:string;customerName:string;amountMinor:number;status:string;mode:string;parasutState:string;merchant:string;installments:number};
type Merchant={id:string;name:string;configured:boolean};
const labels:Record<string,string>={creating:'Hazırlanıyor',ready:'Ödeme bekleniyor',pending:'Sonuç bekleniyor',paid:'Tahsil edildi',failed:'Onaylı tahsilat yok',review:'Kontrol gerekli'};
export default function ParatikaTahsilat({contacts,onLedgerPosted}:{contacts:Contact[];onLedgerPosted:()=>void}){
 const {panelConfirm}=usePanelDialog();const confirmRef=useRef(panelConfirm);confirmRef.current=panelConfirm;const frame=useRef<HTMLIFrameElement>(null);
 const [payments,setPayments]=useState<Payment[]>([]),[merchants,setMerchants]=useState<Merchant[]>([{id:'10013929',name:'Niba Tarım · Tarım POS',configured:false},{id:'10013922',name:'Niba Tarım · Normal POS',configured:false}]);
 const [merchant,setMerchant]=useState('10013929'),[mode,setMode]=useState('test'),[error,setError]=useState(''),[busy,setBusy]=useState(false),[connection,setConnection]=useState(''),[setupIssues,setSetupIssues]=useState<string[]>([]);
 const [contactId,setContactId]=useState(''),[amount,setAmount]=useState(''),[key,setKey]=useState(()=>crypto.randomUUID());
 const configured=Boolean(merchants.find(m=>m.id===merchant)?.configured),minor=Math.round(Number(amount||0)*100);
 async function api(path:string,method='GET',body?:unknown){const {data}=await supabase.auth.getSession();if(!data.session)throw Error('Yönetici oturumu açmanız gerekiyor.');const r=await fetch(path,{method,headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Sanal POS işlemi tamamlanamadı.');return j;}
 async function load(){try{const j=await api('/api/admin/paratika/payments');setPayments(j.payments||[]);setMerchants(j.merchants);setMode(j.mode);setSetupIssues(j.setupIssues||[]);}catch(e){setError(e instanceof Error?e.message:'Tahsilatlar okunamadı.');}}
 useEffect(()=>{void load();},[]);
 function change(){setKey(crypto.randomUUID());setError('');}
 function send(data:unknown){frame.current?.contentWindow?.postMessage(data,location.origin);}
 useEffect(()=>{
  let active=true,sequence=0;
  const context=()=>send({kind:'context',amountMinor:minor});context();
  async function receive(event:MessageEvent){
   if(event.origin!==location.origin||event.source!==frame.current?.contentWindow)return;
   const d=event.data||{};
   if(d.kind==='ready')context();
   if(d.kind==='bin'){
    const current=++sequence;if(!/^\d{8}$/.test(d.bin||''))return;
    try{const j=await api('/api/admin/paratika/installments','POST',{merchant,bin:d.bin});if(active&&current===sequence)send({kind:'options',options:j.options});}
    catch{if(active&&current===sequence)send({kind:'error',message:'Taksit seçenekleri alınamadı. Üye iş yeri bağlantısını kontrol edin.'});}
   }
   if(d.kind==='prepare'){
    const contact=contacts.find(c=>String(c.id)===contactId);
    if(!contact||!configured||!Number.isFinite(minor)||minor<=0){send({kind:'error',message:'Önce müşteri ve geçerli tutar seçin.'});return;}
    if(!await confirmRef.current(`${contact.name} için ${(minor/100).toLocaleString('tr-TR')} TL, ${d.installments} taksit ile tahsilat başlatılacak. Komisyon müşteriye eklenmez. Onaylıyor musunuz?`)){send({kind:'error',message:'Tahsilat başlatılmadı.'});return;}
    if(!active)return;setBusy(true);setError('');
    try{const j=await api('/api/admin/paratika/payments','POST',{key,merchant,customerId:contactId,customerName:contact.name,amount,installments:d.installments,paymentSystem:d.paymentSystem,bin:d.bin});
     if(active&&j.checkout)send({kind:'submit',action:j.checkout});else if(active)send({kind:'error',message:'Bu işlem zaten mevcut veya kontrol bekliyor. Yeni tahsilat başlatmadan durumu kontrol edin.'});await load();
    }catch(e){if(active){const message=e instanceof Error?e.message:'Tahsilat başlatılamadı.';setError(message);send({kind:'error',message});}}finally{if(active)setBusy(false);}
   }
  }
  window.addEventListener('message',receive);return()=>{active=false;sequence++;window.removeEventListener('message',receive);};
 },[merchant,minor,contactId,key,configured,contacts]);
 async function checkConnection(){setBusy(true);setConnection('');try{const j=await api('/api/admin/paratika/connection','POST',{merchant});setConnection(j.message);}catch(e){setConnection(e instanceof Error?e.message:'Bağlantı kontrol edilemedi.');}finally{setBusy(false);}}
 async function check(id:string){setBusy(true);setError('');try{const j=await api('/api/admin/paratika/payments','PATCH',{id});await load();if(j.payment?.parasutState==='posted')onLedgerPosted();}catch(e){setError(e instanceof Error?e.message:'Kontrol tamamlanamadı.');}finally{setBusy(false);}}
 return <section className="mb-6 rounded-3xl border border-emerald-200 bg-white p-5 md:p-7">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Paratika ile Tahsilat</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Kart bilgilerini bu panelde girin. 3D Secure sonrası doğrulanan tahsilat aynı müşterinin Paraşüt carisine işlenir. Komisyon müşteriye eklenmez.</p></div><button onClick={load} disabled={busy} className="rounded-xl border px-4 py-2 text-sm font-bold">Durumları yenile</button></div>
  {mode==='test'&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Test ortamı · Gerçek tahsilat ve Paraşüt kaydı oluşturulmaz.</p>}
  {setupIssues.length>0&&<div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{setupIssues.map(issue=><p key={issue}>{issue}</p>)}</div>}
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={checkConnection} disabled={busy} className="rounded-xl border px-4 py-2 text-sm font-bold">Canlı API bağlantısını kontrol et · Para çekmez</button>{connection&&<p role="status" className="text-sm">{connection}</p>}</div>
  <div className="mt-5 grid gap-3 md:grid-cols-3">
   <label className="text-sm font-bold">Üye iş yeri<select value={merchant} onChange={e=>{setMerchant(e.target.value);change();}} disabled={busy} className="mt-1 w-full rounded-xl border p-3">{merchants.map(m=><option key={m.id} value={m.id}>{m.name} · {m.id}</option>)}</select></label>
   <label className="text-sm font-bold">Müşteri carisi<select value={contactId} onChange={e=>{setContactId(e.target.value);change();}} disabled={busy} className="mt-1 w-full rounded-xl border p-3"><option value="">Cari seçin</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label className="text-sm font-bold">Tahsilat tutarı (TL)<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>{setAmount(e.target.value);change();}} disabled={busy} className="mt-1 w-full rounded-xl border p-3"/></label>
  </div>
  {!configured?<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">Seçilen üye iş yerinin tahsilat bağlantısı henüz açılmadı. Mevcut Paraşüt kayıt ekranını kullanmaya devam edebilirsiniz.</p>:contactId&&minor>0?<iframe key={`${merchant}:${contactId}:${key}`} ref={frame} src="/odeme/kart-formu" title="Güvenli kart girişi ve taksit seçimi" className="mt-4 min-h-[630px] w-full border-0" referrerPolicy="no-referrer"/>:<p className="mt-4 text-sm">Kart girişi için müşteri ve tutar seçin.</p>}
  {payments.length>0&&<div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Müşteri / Üye iş yeri</th><th className="p-2">Tutar / Taksit</th><th className="p-2">Banka sonucu</th><th className="p-2">Paraşüt kaydı</th><th/></tr></thead><tbody>{payments.map(p=><tr key={p.id} className="border-b"><td className="p-2">{p.customerName}<span className="block text-xs text-slate-500">{p.merchant} · {p.reference}</span></td><td className="p-2">{(p.amountMinor/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'})} · {p.installments} taksit</td><td className="p-2">{labels[p.status]||'Kontrol gerekli'}</td><td className="p-2">{p.parasutState==='posted'?"Paraşüt’e işlendi":p.parasutState==='review'||p.parasutState==='posting'?'Kayıt kontrol edilmeli':p.mode==='test'?'Test · Kayıt atılmaz':'Doğrulama bekleniyor'}</td><td className="p-2"><button disabled={busy} onClick={()=>check(p.id)} className="font-bold text-emerald-800 underline">Sonucu kontrol et</button></td></tr>)}</tbody></table></div>}
  <p className="mt-4 text-xs text-slate-500">Bloke süresi: 3 gün. Net tutar doğrulanmış üye iş yeri tarifesine göre tahmin edilir; banka mutabakatı ayrıca kontrol edilir.</p>
 </section>;
}
