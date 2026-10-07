"use client";
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, ChartNoAxesCombined, MessageCircle, RefreshCw, Settings, UserRound, Users, X } from 'lucide-react';
import base from './gonder/send-page.module.css';
import styles from './whatsapp-pages.module.css';
export function WhatsAppShell({title,description,active,children,onRefresh,loading=false,action}:{title:string;description:string;active:'reports'|'groups'|'contacts';children:ReactNode;onRefresh?:()=>void;loading?:boolean;action?:ReactNode}) {
  const links=[{id:'send',label:'Mesajlar ve gönderim',href:'gonder',icon:MessageCircle},{id:'reports',label:'Gönderim raporları',href:'raporlar',icon:ChartNoAxesCombined},{id:'groups',label:'Gruplar',href:'gruplar',icon:Users},{id:'contacts',label:'Kişiler',href:'kisiler',icon:UserRound},{id:'settings',label:'Ayarlar',href:'ayarlar',icon:Settings}];
  return <main className={base.page}><div className={base.container}><Link href="/admin" prefetch={false} className={base.back}><ArrowLeft size={16}/> Yönetim paneli</Link><header className={base.heading}><div><p className={base.eyebrow}>NİBA TARIM · WHATSAPP</p><h1>{title}</h1><p className={base.subtitle}>{description}</p></div><div className={base.headerActions}>{action}{onRefresh && <button type="button" className={base.iconButton} onClick={onRefresh} disabled={loading} aria-label="Listeyi yenile"><RefreshCw size={18} className={loading ? base.spinning : ''}/></button>}</div></header><nav className={base.navigation} aria-label="WhatsApp araçları">{links.map(item=><Link key={item.id} href={`/admin/whatsapp/${item.href}`} prefetch={false} aria-current={active===item.id ? 'page' : undefined}><item.icon size={17}/>{item.label}</Link>)}</nav>{children}</div></main>;
}
export function EditorDialog({title,description,onClose,children}:{title:string;description:string;onClose:()=>void;children:ReactNode}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const el=ref.current;el?.showModal();return()=>{el?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="whatsapp-editor-title" onCancel={event=>{event.preventDefault();onClose();}}><header className={styles.dialogHeader}><div><p className={base.eyebrow}>WHATSAPP KİŞİLERİ</p><h2 id="whatsapp-editor-title">{title}</h2><p>{description}</p></div><button type="button" aria-label="Pencereyi kapat" onClick={onClose} className={base.iconButton}><X size={19}/></button></header>{children}</dialog>;
}
export function Feedback({message}:{message:string}) {return message ? <p role={message.startsWith('❌')?'alert':'status'} className={`${styles.feedback} ${message.startsWith('❌') ? styles.error : ''}`}>{message}</p> : null;}
export function EmptyState({loading=false,filtered=false,label}:{loading?:boolean;filtered?:boolean;label:string}) {return <div className={styles.empty} role="status"><MessageCircle size={27}/><h3>{loading ? 'Yükleniyor…' : filtered ? 'Sonuç bulunamadı' : label}</h3><p>{loading ? 'Bilgiler hazırlanıyor.' : filtered ? 'Arama veya filtreyi değiştirerek tekrar deneyebilirsin.' : 'Yeni kayıtlar burada görünecek.'}</p></div>;}
