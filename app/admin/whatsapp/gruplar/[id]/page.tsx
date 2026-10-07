"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import * as XLSX from "xlsx";
import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet, Plus, Search, UserMinus, UserPlus, UserRound } from 'lucide-react';
import { usePanelDialog } from '@/app/admin/ui/panel-dialog';
import { EmptyState, Feedback, WhatsAppShell } from '../../whatsapp-shell';
import base from '../../gonder/send-page.module.css';
import styles from '../../whatsapp-pages.module.css';

type Contact = {
  id: string;
  name: string | null;
  phone: string;
  note: string | null;
};

type Member = {
  id: string;
  contact_id: string;
  whatsapp_contacts: Contact | null;
};

type PreviewContact = {
  name: string;
  phone: string;
  note: string;
};

function getCell(row: any, possibleKeys: string[]) {
  const rowKeys = Object.keys(row);

  for (const key of possibleKeys) {
    const foundKey = rowKeys.find(
      (rowKey) =>
        rowKey.toString().trim().toLocaleLowerCase("tr-TR") ===
        key.toString().trim().toLocaleLowerCase("tr-TR")
    );

    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return String(row[foundKey]).trim();
    }
  }

  return "";
}

export default function Page() {
  const params = useParams();
  const groupId = String(params?.id || "");
  const {panelConfirm}=usePanelDialog();
  const [search,setSearch]=useState(''),[groupName,setGroupName]=useState(''),[saving,setSaving]=useState(false),[loading,setLoading]=useState(true);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [message, setMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);

  async function loadContacts() {
    const res = await fetch("/api/admin/whatsapp/contacts");
    const data = await res.json();
    if (data.success) setContacts(data.contacts || []);
  }

  async function loadMembers() {
    if (!groupId || groupId === "undefined") return;

    const res = await fetch(
      `/api/admin/whatsapp/group-members?groupId=${groupId}`
    );
    const data = await res.json();

    if (data.success) {
      setMembers(data.members || []);
    } else {
      setMessage("❌ Grup üyeleri yüklenemedi: " + JSON.stringify(data));
    }
  }

  async function addMember() {
    if (!selectedContactId) {
      setMessage("❌ Önce kişi seç.");
      return;
    }

    if (saving) return;
    setSaving(true);
    try {
    const res = await fetch("/api/admin/whatsapp/group-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, contactId: selectedContactId }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage("✅ Kişi gruba eklendi.");
      setSelectedContactId("");
      await loadMembers();
    } else {
      setMessage("❌ Eklenemedi: " + (data.error || 'Tekrar deneyebilirsin.'));
    }
    } catch {setMessage('❌ Kişi eklenemedi. Tekrar deneyebilirsin.');}
    finally {setSaving(false);}
  }

  async function readExcelPreview(file: File) {
    setMessage("Excel okunuyor...");
    setPreviewContacts([]);
    setConfirmImport(false);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      const parsed = rows
        .map((row) => {
          const name = getCell(row, [
            "name",
            "Name",
            "ad",
            "Ad",
            "ad soyad",
            "Ad Soyad",
            "ad soyadı",
            "Ad Soyadı",
            "adı soyadı",
            "Adı Soyadı",
            "isim",
            "İsim",
            "müşteri",
            "Müşteri",
            "müşteri adı",
            "Müşteri Adı",
            "firma",
            "Firma",
            "firma adı",
            "Firma Adı",
            "ünvan",
            "Ünvan",
            "unvan",
            "Unvan",
          ]);

          const phone = getCell(row, [
            "phone",
            "Phone",
            "telefon",
            "Telefon",
            "telefon no",
            "Telefon No",
            "telefon numarası",
            "Telefon Numarası",
            "gsm",
            "GSM",
            "cep",
            "Cep",
            "cep telefonu",
            "Cep Telefonu",
            "whatsapp",
            "WhatsApp",
          ]).replace(/\D/g, "");

          const note = getCell(row, [
            "note",
            "Note",
            "not",
            "Not",
            "açıklama",
            "Açıklama",
            "aciklama",
            "Aciklama",
            "il",
            "İl",
            "sehir",
            "Şehir",
            "şehir",
          ]);

          return {
            name: name || "İsimsiz",
            phone,
            note,
          };
        })
        .filter((item) => item.phone);

      setPreviewContacts(parsed);
      setMessage(
        `✅ Sadece önizleme yapıldı. Henüz gruba aktarılmadı. ${parsed.length} kişi bulundu.`
      );
    } catch (error) {
      setMessage("❌ Excel okunurken hata oluştu: " + String(error));
    }
  }

  async function importPreviewContacts() {
    if (!confirmImport) {
      setMessage("❌ Önce aktarımı onayla.");
      return;
    }

    if (previewContacts.length === 0) {
      setMessage("❌ Önce Excel seçmelisin.");
      return;
    }

    setImporting(true);
    setMessage("Kişiler gruba aktarılıyor...");

    try {
    const res = await fetch("/api/admin/whatsapp/groups/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, contacts: previewContacts }),
    });

    const data = await res.json();

    if (data.success) {
      setMessage(
        `✅ Aktarım tamamlandı. Yeni kişi: ${data.summary.created}, gruba eklenen: ${data.summary.addedToGroup}, atlanan: ${data.summary.skipped}, hatalı: ${data.summary.failed}`
      );

      setPreviewContacts([]);
      setConfirmImport(false);
      await loadContacts();
      await loadMembers();
    } else {
      setMessage("❌ Aktarım yapılamadı: " + JSON.stringify(data));
    }

    } catch {setMessage('❌ Aktarım tamamlanamadı. Tekrar deneyebilirsin.');}
    finally {setImporting(false);}
  }

  useEffect(() => {
    setLoading(true);
    void Promise.all([loadContacts(),loadMembers(),fetch('/api/admin/whatsapp/groups').then(res=>res.json()).then(data=>setGroupName(data.groups?.find((g:any)=>g.id===groupId)?.name || ''))]).catch(()=>setMessage('❌ Grup bilgileri yüklenemedi. Sayfayı yenileyebilirsin.')).finally(()=>setLoading(false));
  }, [groupId]);

  const memberIds = members.map((m) => m.contact_id);
  const availableContacts = contacts.filter((c) => !memberIds.includes(c.id));

  async function removeMember(member:Member) {
    const contactId=member.whatsapp_contacts?.id;
    if (!contactId || saving) return;
    if (!await panelConfirm(`“${member.whatsapp_contacts?.name || member.whatsapp_contacts?.phone}” kişisi bu gruptan çıkarılsın mı? Kişi kaydı korunacak.`)) return;
    setSaving(true);
    try {
      const res=await fetch('/api/admin/whatsapp/group-members/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId,contactId})});
      const data=await res.json();if(!res.ok || !data.success)throw new Error(data.error || 'Kişi gruptan çıkarılamadı.');
      setMessage('✅ Kişi gruptan çıkarıldı.');await loadMembers();
    } catch(error) {setMessage('❌ '+(error instanceof Error ? error.message : 'Kişi gruptan çıkarılamadı.'));}
    finally {setSaving(false);}
  }
  const filteredMembers=members.filter(m=>[m.whatsapp_contacts?.name,m.whatsapp_contacts?.phone,m.whatsapp_contacts?.note].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR').trim()));
  return <WhatsAppShell title={groupName || 'Grup üyeleri'} description="Bu grubun alıcılarını düzenle veya Excel ile toplu kişi ekle." active="groups">
    <Link href="/admin/whatsapp/gruplar" prefetch={false} className={base.back}><ArrowLeft size={16}/> Gruplara dön</Link><Feedback message={message}/>
    <div className={styles.memberLayout}>
      <div className={styles.stack}><section className={styles.panel}><div className={styles.panelTitle}><UserPlus size={22}/><div><h2>Gruba kişi ekle</h2><p>Kayıtlı kişilerden bir alıcı seç.</p></div></div><form onSubmit={event=>{event.preventDefault();void addMember();}}><label className={styles.field}><span>Kişi</span><select value={selectedContactId} onChange={event=>setSelectedContactId(event.target.value)} disabled={saving || importing}><option value="">Kişi seç…</option>{availableContacts.map(c=><option key={c.id} value={c.id}>{c.name || 'İsimsiz'} · {c.phone}</option>)}</select></label><button type="submit" className={base.primary} disabled={saving || importing || !selectedContactId}><Plus size={17}/>{saving?'İşleniyor…':'Gruba ekle'}</button></form><p className={styles.hint}>Gruptaki kişiler tekrar seçim listesinde görünmez.</p></section>
      <section className={styles.panel}><details className={styles.importDetails}><summary><FileSpreadsheet size={22}/> Excel ile toplu kişi ekle</summary><p>Dosya seçince önce önizleme hazırlanır. Gruba eklemek için ayrıca onay vermen gerekir.</p><label className={styles.field}><span>Excel veya CSV dosyası</span><input className={styles.file} type="file" accept=".xlsx,.xls,.csv" disabled={importing} onChange={event=>{const file=event.target.files?.[0];if(file)void readExcelPreview(file);}}/></label>{previewContacts.length>0 && <><p><strong>{previewContacts.length} kişi</strong> aktarım için hazır.</p><div className={styles.importPreview}>{previewContacts.map((c,index)=><div key={index} className={styles.previewRow}><strong>{c.name}</strong><span>{c.phone}</span>{c.note && <small>{c.note}</small>}</div>)}</div><label className={styles.check}><input type="checkbox" checked={confirmImport} onChange={event=>setConfirmImport(event.target.checked)} disabled={importing}/> Bu kişileri gruba eklemeyi onaylıyorum</label><button type="button" className={base.primary} onClick={importPreviewContacts} disabled={importing || !confirmImport}>{importing?'Aktarılıyor…':'Gruba aktar'}</button></>}</details></section></div>
      <section><div className={styles.toolbar}><label className={styles.search}><Search size={17}/><span className="sr-only">Grup üyesi ara</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="İsim, telefon veya not ara…"/></label><span className={styles.hint}>{filteredMembers.length} kişi</span></div><div className={styles.list}><div className={styles.sectionHead}><h2>Grup üyeleri</h2><span>{members.length} alıcı</span></div>{filteredMembers.map(member=><article className={styles.memberRow} key={member.id}><span className={styles.avatar}><UserRound size={21}/></span><div><strong>{member.whatsapp_contacts?.name || 'İsimsiz'}</strong><p>{member.whatsapp_contacts?.phone || 'Telefon belirtilmedi'}</p>{member.whatsapp_contacts?.note && <p>{member.whatsapp_contacts.note}</p>}</div><button type="button" className={styles.danger} disabled={saving || !member.whatsapp_contacts?.id} onClick={()=>removeMember(member)}><UserMinus size={15}/> Gruptan çıkar</button></article>)}{!filteredMembers.length && <EmptyState loading={loading} filtered={!!search} label="Bu grupta henüz kişi yok"/>}</div></section>
    </div>
  </WhatsAppShell>;
}
