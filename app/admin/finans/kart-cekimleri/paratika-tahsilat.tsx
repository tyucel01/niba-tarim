'use client';
import {useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {usePanelDialog} from '@/app/admin/ui/panel-dialog';
type Contact={id:string;name:string;email?:string};
type Payment={id:string;reference:string;customerName:string;amountMinor:number;status:string;mode:string;parasutState:string};
const labels:Record<string,string>={creating:'Hazırlanıyor',ready:'Ödeme bekleniyor',pending:'Sonuç bekleniyor',paid:'Tahsil edildi',failed:'Onaylı tahsilat yok',review:'Kontrol gerekli'};
export default function ParatikaTahsilat({contacts,onLedgerPosted}:{contacts:Contact[];onLedgerPosted:()=>void}){
 const {panelConfirm}=usePanelDialog();
 const [payments,setPayments]=useState<Payment[]>([]),[configured,setConfigured]=useState(false),[mode,setMode]=useState('test'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [contactId,setContactId]=useState(''),[email,setEmail]=useState(''),[amount,setAmount]=useState(''),[checkout,setCheckout]=useState('');
 const [key,setKey]=useState(()=>crypto.randomUUID());
 async function api(method='GET',body?:unknown){const {data}=await supabase.auth.getSession();if(!data.session)throw Error('Yönetici oturumu açmanız gerekiyor.');const r=await fetch('/api/admin/paratika/payments',{method,headers:{Authorization:`Bearer ${data.session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await r.json();if(!r.ok)throw Error(j.error||'Sanal POS işlemi tamamlanamadı.');return j;}
 async function load(){try{const j=await api();setPayments(j.payments||[]);setConfigured(Boolean(j.configured));setMode(j.mode);setError('');}catch(e){setError(e instanceof Error?e.message:'Tahsilatlar okunamadı.');}}
 useEffect(()=>{void load();},[]);
 function change(){setKey(crypto.randomUUID());setCheckout('');}
 async function create(e:React.FormEvent){e.preventDefault();const contact=contacts.find(c=>String(c.id)===contactId);if(!contact)return;
 if(!await panelConfirm(`${contact.name} için ${amount} TL tahsilat bağlantısı hazırlanacak. Kart bilgileri Paratika sayfasında girilecek. Devam edilsin mi?`))return;
 setBusy(true);setError('');try{const j=await api('POST',{key,customerId:contactId,customerName:contact.name,customerEmail:email,amount});setCheckout(j.checkout||'');await load();if(!j.checkout)setError('İşlem mevcut veya sonucu kontrol bekliyor. Listeden kontrol edin; tekrar ödeme başlatmayın.');}catch(e){setError(e instanceof Error?e.message:'Bağlantı oluşturulamadı.');}finally{setBusy(false);}}
 async function check(id:string){setBusy(true);setError('');try{const j=await api('PATCH',{id});await load();if(j.payment?.parasutState==='posted')onLedgerPosted();}catch(e){setError(e instanceof Error?e.message:'Kontrol tamamlanamadı.');}finally{setBusy(false);}}
 return <section className="mb-6 rounded-3xl border border-emerald-200 bg-white p-5 md:p-7">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Paratika ile Tahsilat</h2><p className="mt-2 max-w-3xl text-sm text-slate-600">Paratika’dan doğrulanan tahsilat, aynı carinin Paraşüt kaydına ve aşağıdaki Kart Çekimleri listesine işlenir. Bankada sonucu belirsiz işlemlerde ikinci kez kayıt oluşturulmaz.</p></div><button onClick={load} disabled={busy} className="rounded-xl border px-4 py-2 text-sm font-bold">Durumları yenile</button></div>
  {mode==='test'&&<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Test ortamı · Gerçek tahsilat ve Paraşüt kaydı oluşturulmaz.</p>}
  {!configured&&<p className="mt-3 text-sm text-slate-600">Sanal POS tahsilatı henüz açılmadı. Aşağıdaki mevcut Paraşüt kayıt ekranını kullanmaya devam edebilirsiniz.</p>}
  {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  <form onSubmit={create} className="mt-5 grid gap-3 md:grid-cols-4">
   <label className="text-sm font-bold">Müşteri carisi<select value={contactId} onChange={e=>{setContactId(e.target.value);setEmail(contacts.find(c=>String(c.id)===e.target.value)?.email||'');change();}} required disabled={!configured||busy} className="mt-1 w-full rounded-xl border p-3"><option value="">Cari seçin</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <label className="text-sm font-bold">Müşteri e-posta<input type="email" value={email} onChange={e=>{setEmail(e.target.value);change();}} required maxLength={64} disabled={!configured||busy} className="mt-1 w-full rounded-xl border p-3"/></label>
   <label className="text-sm font-bold">Tahsilat tutarı (TL)<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>{setAmount(e.target.value);change();}} required disabled={!configured||busy} className="mt-1 w-full rounded-xl border p-3"/></label>
   <button disabled={!configured||busy} className="self-end rounded-xl bg-emerald-800 p-3 font-bold text-white disabled:opacity-40">{busy?'İşlem sürüyor…':'Ödeme bağlantısı oluştur'}</button>
  </form>
  {checkout&&<div className="mt-4 flex flex-wrap gap-4 rounded-xl bg-emerald-50 p-4"><a href={checkout} target="_blank" rel="noreferrer noopener" className="font-bold text-emerald-800 underline">Paratika ödeme sayfasını aç</a><button className="font-bold text-emerald-800 underline" onClick={async()=>{try{await navigator.clipboard.writeText(checkout);}catch{setError('Bağlantı kopyalanamadı. Ödeme sayfasını açarak adresini kopyalayabilirsiniz.');}}}>Bağlantıyı kopyala</button></div>}
  {payments.length>0&&<div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Müşteri</th><th className="p-2">Tutar</th><th className="p-2">Banka sonucu</th><th className="p-2">Paraşüt kaydı</th><th/></tr></thead><tbody>{payments.map(p=><tr key={p.id} className="border-b"><td className="p-2">{p.customerName}<span className="block text-xs text-slate-500">{p.reference}</span></td><td className="p-2">{(p.amountMinor/100).toLocaleString('tr-TR',{style:'currency',currency:'TRY'})}</td><td className="p-2">{labels[p.status]||'Kontrol gerekli'}</td><td className="p-2">{p.parasutState==='posted'?"Paraşüt’e işlendi":p.parasutState==='review'||p.parasutState==='posting'?'Kayıt kontrol edilmeli':p.mode==='test'?'Test · Kayıt atılmaz':'Doğrulama bekleniyor'}</td><td className="p-2"><button disabled={busy} onClick={()=>check(p.id)} className="font-bold text-emerald-800 underline">Sonucu kontrol et</button></td></tr>)}</tbody></table></div>}
  <p className="mt-4 text-xs text-slate-500">Bloke süresi: 3 gün. Banka mutabakatı ve kullanılabilir bakiye, ayrı Paratika hesabından takip edilir.</p>
 </section>;
}
