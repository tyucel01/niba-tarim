"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Clock3, Search, Send, XCircle } from 'lucide-react';
import { usePanelDialog } from '@/app/admin/ui/panel-dialog';
import { EmptyState, Feedback, WhatsAppShell } from '../whatsapp-shell';
import styles from '../whatsapp-pages.module.css';

function getStatusText(status: string) {
  const s = (status || "").toLowerCase();

  if (s === "completed") return "Tamamlandı";
  if (s === "cancelled") return "İptal";
  if (s === "processing") return "Gönderiliyor";
  if (s === "pending") return "Bekliyor";

  return "-";
}

function getRealStatus(c: any) {
  const total = c.total_count || 0;
  const success = c.success_count || 0;
  const fail = c.fail_count || 0;
  const done = success + fail;
  const dbStatus = (c.status || "").toLowerCase();

  if (dbStatus === "cancelled") return "cancelled";
  if (total > 0 && done >= total) return "completed";
  if (total > 0 && done < total) return "processing";

  return dbStatus || "pending";
}

function formatDate(value?: string) {
  if (!value) return "-";

  try {
    return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "Z").toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
    });
  } catch {
    return "-";
  }
}

export default function Page(){
  const [campaigns,setCampaigns]=useState<any[]>([]),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[lastUpdated,setLastUpdated]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[cancelling,setCancelling]=useState('');
  const inFlight=useRef(false);const {panelConfirm}=usePanelDialog();
  async function loadCampaigns(){if(inFlight.current)return;inFlight.current=true;setLoading(true);try{const res=await fetch(`/api/admin/whatsapp/campaigns?t=${Date.now()}`,{cache:'no-store'});const data=await res.json();if(!res.ok || !data.success)throw new Error(data.error || 'Raporlar yüklenemedi.');setCampaigns(data.campaigns || []);setLastUpdated(new Date().toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit',second:'2-digit'}));}catch(error){setMessage('❌ '+(error instanceof Error?error.message:'Raporlar yüklenemedi.'));}finally{setLoading(false);inFlight.current=false;}}
  async function cancelCampaign(id:string){if(cancelling || !await panelConfirm('Bu kampanyanın kalan gönderimleri iptal edilsin mi? Gönderilmiş mesajlar geri alınmaz.'))return;setCancelling(id);setMessage('');try{const res=await fetch('/api/admin/whatsapp/campaigns/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({campaignId:id})});const data=await res.json();if(!res.ok || !data.success)throw new Error(data.error || 'Gönderim iptal edilemedi.');setMessage('✅ Kampanyanın bekleyen mesajları iptal edildi.');await loadCampaigns();}catch(error){setMessage('❌ '+(error instanceof Error?error.message:'Gönderim iptal edilemedi.'));}finally{setCancelling('');}}
  useEffect(()=>{void loadCampaigns();const timer=setInterval(()=>{if(document.visibilityState==='visible')void loadCampaigns();},15000);return()=>clearInterval(timer);},[]);
  const stats=campaigns.reduce((out,c)=>{out.success+=Number(c.success_count || 0);out.fail+=Number(c.fail_count || 0);if(getRealStatus(c)!=='cancelled')out.remaining+=Math.max(Number(c.total_count || 0)-Number(c.success_count || 0)-Number(c.fail_count || 0),0);return out;},{success:0,fail:0,remaining:0});
  const filtered=campaigns.filter(c=>(filter==='all' || getRealStatus(c)===filter) && String(c.template_name || '').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR').trim()));
  return <WhatsAppShell title="Gönderim raporları" description="Kampanyalarını, gönderim sonuçlarını ve sıradaki mesajları takip et." active="reports" onRefresh={loadCampaigns} loading={loading}>
    <section className={styles.stats} aria-label="Gönderim özeti">{[{title:'Kampanya',value:campaigns.length,icon:Send},{title:'Başarılı gönderim',value:stats.success,icon:CheckCircle2},{title:'Hatalı gönderim',value:stats.fail,icon:XCircle},{title:'Bekleyen mesaj',value:stats.remaining,icon:Clock3}].map(item=><div key={item.title} className={styles.stat}><item.icon size={24}/><div><span>{item.title}</span><strong>{loading && !lastUpdated ? '—' : new Intl.NumberFormat('tr-TR').format(item.value)}</strong></div></div>)}</section>
    <Feedback message={message}/><div className={styles.toolbar}><label className={styles.search}><Search size={17}/><span className="sr-only">Kampanya ara</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Şablon adına göre ara…"/></label><span className={styles.hint}>{lastUpdated ? `Son güncelleme: ${lastUpdated} · 15 saniyede bir yenilenir` : 'Raporlar hazırlanıyor…'}</span></div>
    <div className={styles.filters} aria-label="Gönderim durumu">{[{id:'all',label:'Tümü'},{id:'processing',label:'Gönderiliyor'},{id:'pending',label:'Bekliyor'},{id:'completed',label:'Tamamlandı'},{id:'cancelled',label:'İptal edildi'}].map(item=><button key={item.id} type="button" aria-pressed={filter===item.id} onClick={()=>setFilter(item.id)}>{item.label}</button>)}</div>
    <section aria-label="Kampanya sonuçları">{filtered.map(c=>{const total=Number(c.total_count || 0),success=Number(c.success_count || 0),fail=Number(c.fail_count || 0),done=success+fail,remaining=Math.max(total-done,0),percent=total>0?Math.min(Math.round(done/total*100),100):0,status=getRealStatus(c);const canCancel=status!=='completed' && status!=='cancelled' && remaining>0;return <article key={c.id} className={styles.campaign}><header className={styles.campaignHeader}><div><h2>{c.template_name || 'Şablon belirtilmedi'}</h2><p>{formatDate(c.created_at)}</p></div><span className={`${styles.badge} ${styles[status] || ''}`}>{getStatusText(status)}</span></header><div className={styles.campaignBody}><div><div className={styles.progressLabel}><span>{done} / {total} mesaj işlendi</span><strong>%{percent}</strong></div><div className={styles.progress} role="progressbar" aria-label={`${c.template_name || 'Kampanya'} ilerlemesi`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div style={{width:`${percent}%`}}/></div><p className={styles.progressNote}>{status==='completed'?'Tüm mesajlar işlendi.':status==='cancelled'?`${remaining} mesaj iptal nedeniyle gönderilmedi.`:`${remaining} mesaj sırada bekliyor.`}</p></div><div className={styles.metrics}>{[{label:'Toplam',value:total},{label:'Başarılı',value:success},{label:'Hatalı',value:fail},{label:status==='cancelled'?'Gönderilmedi':'Kalan',value:remaining}].map(m=><div key={m.label} className={styles.metric}><span>{m.label}</span><strong>{m.value}</strong></div>)}</div></div>{canCancel && <footer className={styles.campaignFooter}><span>Bekleyen gönderimleri durdurabilirsin.</span><button type="button" className={styles.danger} onClick={()=>cancelCampaign(c.id)} disabled={!!cancelling}>{cancelling===c.id?'İptal ediliyor…':'Kalanı iptal et'}</button></footer>}</article>;})}{!filtered.length && <EmptyState loading={loading} filtered={!!search || filter!=='all'} label="Henüz gönderim raporu yok"/>}</section>
  </WhatsAppShell>;
}
