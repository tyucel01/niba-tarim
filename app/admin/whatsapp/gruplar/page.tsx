"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Plus, Search, Trash2, Users } from 'lucide-react';
import { usePanelDialog } from '@/app/admin/ui/panel-dialog';
import { EmptyState, Feedback, WhatsAppShell } from '../whatsapp-shell';
import base from '../gonder/send-page.module.css';
import styles from '../whatsapp-pages.module.css';
type Group={id:string;name:string};
export default function Page() {
  const [groups,setGroups]=useState<Group[]>([]),[name,setName]=useState(''),[message,setMessage]=useState(''),[search,setSearch]=useState('');
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[deleting,setDeleting]=useState('');
  const {panelConfirm}=usePanelDialog();
  async function loadGroups(){setLoading(true);try{const res=await fetch('/api/admin/whatsapp/groups',{cache:'no-store'});const data=await res.json();if(!res.ok || !data.success)throw new Error('Gruplar yüklenemedi. Tekrar deneyebilirsin.');setGroups(data.groups || []);}catch(error){setMessage('❌ '+(error instanceof Error?error.message:'Gruplar yüklenemedi.'));}finally{setLoading(false);}}
  async function createGroup(){if(saving)return;if(!name.trim()){setMessage('❌ Grup adı yaz.');return;}setSaving(true);setMessage('');try{const res=await fetch('/api/admin/whatsapp/groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim()})});const data=await res.json();if(!res.ok || !data.success)throw new Error(data.error || 'Grup oluşturulamadı.');setName('');setMessage('✅ Grup oluşturuldu. Kişileri yöneterek alıcılarını ekleyebilirsin.');await loadGroups();}catch(error){setMessage('❌ '+(error instanceof Error?error.message:'Grup oluşturulamadı.'));}finally{setSaving(false);}}
  async function deleteGroup(group:Group){if(deleting || !await panelConfirm(`“${group.name}” grubunu silmek istiyor musun? Grup üyelerinin kişi kayıtları korunacak.`))return;setDeleting(group.id);try{const res=await fetch(`/api/admin/whatsapp/groups/${encodeURIComponent(group.id)}`,{method:'DELETE'});const data=await res.json();if(!res.ok || !data.success)throw new Error(data.error || 'Grup silinemedi.');setMessage('✅ Grup silindi.');await loadGroups();}catch(error){setMessage('❌ '+(error instanceof Error?error.message:'Grup silinemedi.'));}finally{setDeleting('');}}
  useEffect(()=>{void loadGroups();},[]);
  const filtered=groups.filter(g=>g.name.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR').trim()));
  return <WhatsAppShell title="Gruplar" description="Alıcılarını grupla, toplu gönderimlerini kolayca hazırla." active="groups" onRefresh={loadGroups} loading={loading}>
    <section className={styles.panel}><div className={styles.panelTitle}><Users size={21}/><div><h2>Yeni alıcı grubu</h2><p>Oluşturduktan sonra gruba istediğin kişileri ekleyebilirsin.</p></div></div><form className={styles.formRow} onSubmit={event=>{event.preventDefault();void createGroup();}}><label className={styles.field}><span>Grup adı</span><input value={name} onChange={event=>setName(event.target.value)} placeholder="Örn. Bayiler, Mersin müşterileri…" maxLength={200}/></label><button type="submit" className={base.primary} disabled={saving || !name.trim()}><Plus size={17}/>{saving?'Oluşturuluyor…':'Grup oluştur'}</button></form></section>
    <Feedback message={message}/><div className={styles.toolbar}><label className={styles.search}><Search size={17}/><span className="sr-only">Grup ara</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Grup adına göre ara…"/></label><span className={styles.hint}>{filtered.length} grup</span></div>
    {filtered.length ? <section className={styles.grid} aria-label="Alıcı grupları">{filtered.map(g=><article key={g.id} className={styles.groupCard}><div className={styles.groupTop}><span className={styles.avatar}><Users size={22}/></span><div><h2>{g.name}</h2><p>WhatsApp alıcı grubu</p></div></div><div className={styles.groupActions}><Link href={`/admin/whatsapp/gruplar/${encodeURIComponent(g.id)}`} prefetch={false} className={styles.manage}>Kişileri yönet <ArrowRight size={16}/></Link><button type="button" className={styles.danger} onClick={()=>deleteGroup(g)} disabled={!!deleting} aria-label={`${g.name} grubunu sil`}><Trash2 size={15}/>{deleting===g.id?'Siliniyor…':'Sil'}</button></div></article>)}</section> : <EmptyState loading={loading} filtered={!!search} label="Henüz alıcı grubu yok"/>}
  </WhatsAppShell>;
}
