"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useConversation } from "@/lib/whatsapp/use-conversation";
import { PRICE_HANDOFF_KEY, parsePriceHandoff, handoffFile, type PriceHandoff } from "@/lib/whatsapp/price-handoff";
import { SendConfirmation } from "./send-confirmation";
import { MessageContent } from "./message-content";
import Link from 'next/link';
import { ArrowLeft, Archive, ChartNoAxesCombined, Check, ChevronDown, FileText, ImagePlus, MessageCircle, Plus, RefreshCw, Search, Send, Settings, UserRound, Users, X } from 'lucide-react';
import { usePanelDialog } from '@/app/admin/ui/panel-dialog';
import styles from './send-page.module.css';

type TemplateComponent = {
  type: string;
  format?: string;
  text?: string;
};

type Template = {
  name: string;
  language: string;
  status: string;
  category: string;
  components: TemplateComponent[];
};

type GroupMember = {
  id: string;
  contact_id: string;
  whatsapp_contacts: {
    id: string;
    name: string | null;
    phone: string;
    note: string | null;
  } | null;
};

type Conversation = {
  id: string;
  phone: string;
  name: string | null;
  status: string;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
};

function countVariables(text: string) {
  const matches = text.match(/{{\s*\d+\s*}}/g);
  return matches ? matches.length : 0;
}

function replaceVariables(text: string, values: string[]) {
  let output = text;

  values.forEach((value, index) => {
    const regex = new RegExp(`{{\\s*${index + 1}\\s*}}`, "g");
    output = output.replace(regex, value || `{{${index + 1}}}`);
  });

  return output;
}

function initials(value?: string | null) {
  return (value || "?").slice(0, 1).toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "";
  }
}

export default function Page() {
  const router = useRouter();
  const { panelConfirm } = usePanelDialog();
  const [targetTab, setTargetTab] = useState<'groups'|'contacts'|'chats'>('groups');
  const [targetSearch, setTargetSearch] = useState('');
  const [listsLoading, setListsLoading] = useState(true);
  const [listError, setListError] = useState('');
  const templateDialog = useRef<HTMLDialogElement>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [groupId, setGroupId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  useEffect(()=>{
    if (!templateModalOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    templateDialog.current?.showModal();
    return ()=>previous?.focus();
  }, [templateModalOpen]);


  const [confirmOpen, setConfirmOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({});
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const conversationListRequest = useRef(0);

  const [pendingPriceImage, setPendingPriceImage] = useState<PriceHandoff | null>(null);
  const uploadController = useRef<AbortController | null>(null);
  const [priceImageName, setPriceImageName] = useState("");
  const [priceImageError, setPriceImageError] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [bodyVariables, setBodyVariables] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/admin");
    });
  }, [router]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("source") !== "fiyat-formu") return;
    try {
      const draft = parsePriceHandoff(sessionStorage.getItem(PRICE_HANDOFF_KEY));
      // Restore a browser handoff once; no campaign or recipient is selected here.
      if (draft) {
        setPendingPriceImage(draft); setPriceImageName(draft.name);
      } else setPriceImageError("Fiyat görseli bulunamadı veya süresi doldu. Fiyat formundan tekrar aktarın.");
    } catch { setPriceImageError("Fiyat görseli alınamadı. Fiyat formundan tekrar aktarın."); }
  }, []);

  function removePriceImage() {
    uploadController.current?.abort();
    setPendingPriceImage(null); setPriceImageName(""); setHeaderImageUrl(""); setPriceImageError("");
    try { sessionStorage.removeItem(PRICE_HANDOFF_KEY); } catch { /* Storage may be unavailable. */ }
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function loadGroups() {
    const res = await fetch(`/api/admin/whatsapp/groups?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data.success === false) throw new Error();
    setGroups(data.groups || []);
  }

  async function loadContacts() {
    const res = await fetch(`/api/admin/whatsapp/contacts?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error();
    setContacts(data.contacts || []);
  }

  const loadConversations = useCallback(async () => {
    const request = ++conversationListRequest.current;
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.success && request === conversationListRequest.current) setConversations(data.conversations || []);
    } catch { /* Retain the current list during temporary network errors. */ }
  }, []);

  const { messages: conversationMessages, loading: messagesLoading, error: messagesError, refresh: refreshMessages } =
    useConversation(selectedConversation?.id, loadConversations);

  async function loadGroupMembers(targetGroupId: string) {
    const res = await fetch(`/api/admin/whatsapp/group-members?groupId=${targetGroupId}`);
    const data = await res.json();

    if (data.success) {
      setGroupMembers((prev) => ({
        ...prev,
        [targetGroupId]: data.members || [],
      }));
    }
  }

  async function toggleGroup(groupIdToToggle: string) {
    const nextValue = !openGroupIds[groupIdToToggle];

    setOpenGroupIds((prev) => ({
      ...prev,
      [groupIdToToggle]: nextValue,
    }));

    if (nextValue && !groupMembers[groupIdToToggle]) {
      await loadGroupMembers(groupIdToToggle);
    }
  }

  function openConversation(conversation: Conversation) {
    setSelectedConversation(conversation);
    setSelectedContact(null);
    setGroupId("");
    setReplyText("");
    setMsg("");
  }

  async function loadTemplates() {
    const res = await fetch("/api/admin/whatsapp/templates");
    const data = await res.json();

    if (data.success) {
      setTemplates(data.templates || []);
      const first = data.templates?.[0];
      if (first && new URLSearchParams(window.location.search).get("source") !== "fiyat-formu") setSelectedTemplateKey(previous => previous || `${first.name}__${first.language}`);
    } else {
      setMsg("❌ Şablon listesi alınamadı: " + JSON.stringify(data.error));
    }
  }

  const selectedGroup = groups.find((g) => g.id === groupId);
  const selectedTargetName = selectedGroup?.name || selectedContact?.name || selectedContact?.phone || "";

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => `${t.name}__${t.language}` === selectedTemplateKey);
  }, [templates, selectedTemplateKey]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;

    return templates.filter((t) => {
      const body = t.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text || "";
      return [t.name, t.language, t.category, t.status, body]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [templates, templateSearch]);

  const bodyText = selectedTemplate?.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text || "";

  const headerComponent = selectedTemplate?.components?.find((c) => c.type?.toUpperCase() === "HEADER");

  const hasImageHeader = headerComponent?.format?.toUpperCase() === "IMAGE";
  const variableCount = countVariables(bodyText);
  const previewText = replaceVariables(bodyText, bodyVariables);
  const hasTarget = !!groupId || !!selectedContact;
  const readyToSend = (!hasImageHeader || !priceImageError) && hasTarget && !!selectedTemplate && (!hasImageHeader || !!headerImageUrl) && (variableCount === 0 || bodyVariables.every((v) => v.trim()));
  const selectedGroupMemberCount = selectedGroup?.member_count || selectedGroup?.contacts_count || selectedGroup?.count || groupMembers[groupId]?.length || 0;
  const estimatedRecipients = selectedGroup ? selectedGroupMemberCount || "Grup" : selectedContact ? 1 : 0;
  const totalUnread = conversations.reduce((sum, item) => sum + (item.unread_count || 0), 0);

  useEffect(() => {
    const values = Array.from({ length: variableCount }).map((_, index) => bodyVariables[index] || "");
    setBodyVariables(values);
  }, [selectedTemplateKey, variableCount]);

  // Keep a prepared image while choosing templates; text templates never receive it.

  async function uploadImage(file: File, fromPrice = false) {
    uploadController.current?.abort();
    const controller = new AbortController(); uploadController.current = controller;
    try {
      setUploading(true);
      setMsg("Görsel yükleniyor...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/whatsapp/media/upload", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        setMsg("❌ Upload API JSON dönmedi: " + text.slice(0, 300));
        return;
      }

      if (controller.signal.aborted) return;
      if (res.ok && data.success && typeof data.url === "string") {
        setHeaderImageUrl(data.url);
        if (!fromPrice) { setPriceImageName(""); setPendingPriceImage(null);
          try { sessionStorage.removeItem(PRICE_HANDOFF_KEY); } catch { /* Optional handoff. */ }
        }
        setMsg("✅ Görsel yüklendi.");
      } else {
        setMsg("❌ Görsel yüklenemedi: " + JSON.stringify(data));
      }
    } catch {
      if (!controller.signal.aborted) setMsg("❌ Görsel yüklenemedi. Şablonu yeniden seçerek tekrar deneyin.");
    } finally {
      if (uploadController.current === controller) setUploading(false);
    }
  }

  async function send() {
    if (uploading || sending) return;
    if (hasImageHeader && priceImageError) {
      setMsg("❌ Fiyat görselini yeniden aktar veya başka bir görsel yükle.");
      return;
    }
    if (!groupId && !selectedContact) {
      setMsg("❌ Önce soldan bir grup veya kişi seçmelisin.");
      return;
    }

    if (!selectedTemplate) {
      setMsg("❌ Şablon seçmelisin.");
      return;
    }

    if (hasImageHeader && !headerImageUrl) {
      setMsg("❌ Bu şablon görsel istiyor. Önce görsel yükle.");
      return;
    }

    if (variableCount > 0 && bodyVariables.some((v) => !v.trim())) {
      setMsg("❌ Tüm değişkenleri doldurmalısın.");
      return;
    }

    try {
      setSending(true);
      setMsg("Gönderim kuyruğa alınıyor...");

      const res = await fetch("/api/admin/whatsapp/send-campaign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId: groupId || null,
          contactId: selectedContact?.id || null,
          templateName: selectedTemplate.name,
          languageCode: selectedTemplate.language,
          headerImageUrl: hasImageHeader ? headerImageUrl || null : null,
          bodyVariables,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMsg(`✅ Gönderim kuyruğa alındı. ${data.queued} kişi sıraya eklendi. Mesajlar sırayla gönderilecek.`);
      } else {
        setMsg("❌ " + JSON.stringify(data));
      }
    } catch (err) {
      setMsg("❌ Gönderim hatası: " + String(err));
    } finally {
      setSending(false);
    }
  }

  async function sendReply() {
    if (!selectedConversation || !replyText.trim()) return;

    try {
      setReplying(true);
      setMsg("Cevap gönderiliyor...");

      const res = await fetch("/api/admin/whatsapp/conversations/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          phone: selectedConversation.phone,
          text: replyText.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMsg("❌ Cevap gönderilemedi: " + JSON.stringify(data.error || data));
        return;
      }

      setReplyText("");
      setMsg("✅ Cevap gönderildi.");

      refreshMessages();
      await loadConversations();
    } catch (err) {
      setMsg("❌ Cevap hatası: " + String(err));
    } finally {
      setReplying(false);
    }
  }

  async function archiveConversation(conversationId: string) {
    if (!await panelConfirm("Bu konuşma arşivlensin mi?")) return;

    try {
      const res = await fetch("/api/admin/whatsapp/conversations/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversationId }),
      });

      const data = await res.json();

      if (!data.success) {
        setMsg("❌ Konuşma arşivlenemedi: " + JSON.stringify(data.error || data));
        return;
      }

      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setReplyText("");
      }

      setMsg("✅ Konuşma arşivlendi.");
      await loadConversations();
    } catch (err) {
      setMsg("❌ Arşivleme hatası: " + String(err));
    }
  }

  async function refreshLists() {
    setListsLoading(true); setListError('');
    try { await Promise.all([loadGroups(),loadContacts(),loadTemplates(),loadConversations()]); }
    catch { setListError('Alıcı bilgileri yenilenemedi. Tekrar deneyebilirsin.'); }
    finally { setListsLoading(false); }
  }
  useEffect(() => {
    void refreshLists();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void loadConversations();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const hasSelection = !!selectedConversation || hasTarget;
  const matches = (values: unknown[]) => values.filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(targetSearch.toLocaleLowerCase('tr-TR').trim());
  function clearTarget() { setSelectedConversation(null); setGroupId(''); setSelectedContact(null); setMsg(''); }
  function chooseContact(contact: any) { setSelectedContact(contact); setGroupId(''); setSelectedConversation(null); setMsg(''); }
  function chooseGroup(id: string) { setGroupId(id); setSelectedContact(null); setSelectedConversation(null); setMsg(''); }
  const missing = !selectedTemplate ? 'Bir mesaj şablonu seç.' : uploading ? 'Görsel yükleniyor…' : hasImageHeader && !headerImageUrl ? 'Şablon için bir görsel ekle.' : bodyVariables.some(value => !value.trim()) ? 'Mesaj alanlarını doldur.' : '';
  return <main className={styles.page}>
    <div className={styles.container}>
      <Link href="/admin" prefetch={false} className={styles.back}><ArrowLeft size={16}/> Yönetim paneli</Link>
      <header className={styles.heading}><div><p className={styles.eyebrow}>NİBA TARIM</p><h1>WhatsApp</h1><p className={styles.subtitle}>Müşterilerinle iletişimde kal, mesajlarını tek yerden hazırla.</p></div><div className={styles.headerActions}><Link href="/admin/whatsapp/raporlar" prefetch={false} className={styles.secondary}><ChartNoAxesCombined size={17}/> Gönderim raporları</Link><button type="button" className={styles.iconButton} onClick={refreshLists} disabled={listsLoading} aria-label="Alıcı listesini yenile"><RefreshCw size={18} className={listsLoading ? styles.spinning : ''}/></button></div></header>
      <nav className={styles.navigation} aria-label="WhatsApp araçları"><Link href="/admin/whatsapp/gonder" prefetch={false} aria-current="page"><MessageCircle size={17}/> Mesajlar ve gönderim</Link><Link href="/admin/whatsapp/gruplar" prefetch={false}><Users size={17}/> Gruplar</Link><Link href="/admin/whatsapp/kisiler" prefetch={false}><UserRound size={17}/> Kişiler</Link><Link href="/admin/whatsapp/ayarlar" prefetch={false}><Settings size={17}/> Ayarlar</Link></nav>
      {(priceImageName || priceImageError) && <section className={styles.handoff} aria-label="Fiyat görseli"><ImagePlus size={24}/><div><strong>{priceImageName ? 'Fiyat görselin hazır' : 'Görsel aktarılamadı'}</strong><p>{priceImageError || (selectedTemplate && !hasImageHeader ? 'Bu şablon yalnızca metin gönderir. Görsel kullanmak için görselli bir şablon seç.' : headerImageUrl ? 'Görsel mesaja eklendi. Önizlemeyi kontrol et.' : 'Görselli bir şablon seçtiğinde fiyat listen mesaja eklenecek.')}</p></div><button type="button" className={styles.secondary} onClick={removePriceImage}>Görseli kaldır</button></section>}
      {listError && <p className={styles.error} role="alert">{listError} <button type="button" onClick={refreshLists}>Yeniden dene</button></p>}
      <div className={`${styles.workspace} ${hasSelection ? styles.selected : ''}`}>
        <aside className={styles.recipients} aria-label="Alıcılar">
          <div className={styles.recipientHeader}><h2>Alıcılar</h2><span>{contacts.length} kişi · {groups.length} grup</span></div>
          <label className={styles.search}><Search size={17}/><span className="sr-only">Grup, kişi veya telefon ara</span><input value={targetSearch} onChange={event=>setTargetSearch(event.target.value)} placeholder="Grup, kişi veya telefon ara…"/></label>
          <div className={styles.tabs} role="tablist" aria-label="Alıcı türü">{([{id:'groups',label:'Gruplar',count:groups.length},{id:'contacts',label:'Kişiler',count:contacts.length},{id:'chats',label:'Görüşmeler',count:totalUnread}] as const).map(item=><button key={item.id} type="button" id={`tab-${item.id}`} role="tab" aria-selected={targetTab===item.id} aria-controls="recipient-list" onClick={()=>setTargetTab(item.id)}>{item.label}{item.count>0 && <span>{item.count}</span>}</button>)}</div>
          <div id="recipient-list" role="tabpanel" aria-labelledby={`tab-${targetTab}`} className={styles.recipientList} aria-busy={listsLoading}>
            {targetTab==='groups' && groups.filter(g=>matches([g.name])).map(g=><div key={g.id} className={styles.groupRow}><div className={styles.groupMain}><button type="button" className={`${styles.person} ${groupId===g.id ? styles.active : ''}`} onClick={()=>chooseGroup(g.id)}><span className={styles.avatar}><Users size={20}/></span><span className={styles.personText}><strong>{g.name}</strong><small>{g.member_count || g.contacts_count || g.count || groupMembers[g.id]?.length || '—'} kişi · Toplu gönderim</small></span>{groupId===g.id && <Check size={17}/>}</button><button type="button" className={styles.expand} onClick={()=>toggleGroup(g.id)} aria-label={`${g.name} grubunun üyeleri`} aria-expanded={!!openGroupIds[g.id]}><ChevronDown size={16} className={openGroupIds[g.id] ? styles.rotated : ''}/></button></div>{openGroupIds[g.id] && <div className={styles.members}>{(groupMembers[g.id] || []).map(member=><button key={member.id} type="button" onClick={()=>member.whatsapp_contacts && chooseContact(member.whatsapp_contacts)}><strong>{member.whatsapp_contacts?.name || 'İsimsiz'}</strong><small>{member.whatsapp_contacts?.phone}</small></button>)}{!groupMembers[g.id]?.length && <p>Üye bulunamadı.</p>}</div>}</div>)}
            {targetTab==='contacts' && contacts.filter(c=>matches([c.name,c.phone])).map(c=><button key={c.id} type="button" className={`${styles.person} ${selectedContact?.id===c.id ? styles.active : ''}`} onClick={()=>chooseContact(c)}><span className={styles.avatar}>{initials(c.name || c.phone)}</span><span className={styles.personText}><strong>{c.name || 'İsimsiz'}</strong><small>{c.phone}</small></span>{selectedContact?.id===c.id && <Check size={17}/>}</button>)}
            {targetTab==='chats' && conversations.filter(c=>matches([c.name,c.phone,c.last_message])).map(c=><button key={c.id} type="button" className={`${styles.person} ${selectedConversation?.id===c.id ? styles.active : ''}`} onClick={()=>openConversation(c)}><span className={styles.avatar}>{initials(c.name || c.phone)}</span><span className={styles.personText}><strong>{c.name || c.phone}</strong><small>{c.last_message || 'Yeni görüşme'}</small></span>{c.unread_count>0 && <span className={styles.unread}>{c.unread_count}</span>}</button>)}
            {listsLoading && !groups.length && !contacts.length && <p className={styles.listEmpty}>Alıcılar yükleniyor…</p>}
            {!listsLoading && !(targetTab==='groups' ? groups.filter(g=>matches([g.name])) : targetTab==='contacts' ? contacts.filter(c=>matches([c.name,c.phone])) : conversations.filter(c=>matches([c.name,c.phone,c.last_message]))).length && <div className={styles.listEmpty}><Search size={22}/><p>{targetSearch ? 'Aramana uygun sonuç bulunamadı.' : targetTab==='chats' ? 'Henüz bir görüşme yok.' : 'Henüz alıcı yok.'}</p></div>}
          </div>
          <div className={styles.recipientFooter}><span>Yeni alıcı ekle</span><Link href="/admin/whatsapp/gruplar" prefetch={false}>Grup <Plus size={14}/></Link><Link href="/admin/whatsapp/kisiler" prefetch={false}>Kişi <Plus size={14}/></Link></div>
        </aside>
        <section className={styles.content} aria-label={selectedConversation ? 'Görüşme' : 'Mesaj hazırlama'}>
          {!hasSelection ? <div className={styles.empty}><span className={styles.emptyIcon}><MessageCircle size={36} strokeWidth={1.5}/></span><p className={styles.eyebrow}>MESAJLARIN BURADAN BAŞLAR</p><h2>Kime mesaj göndermek istersin?</h2><p>Bir grup veya kişi seç, mesajını hazırla ve göndermeden önce önizlemesini kontrol et.</p><div className={styles.emptySteps}><span><Users size={17}/> Alıcı seç</span><span><FileText size={17}/> Mesaj hazırla</span><span><Check size={17}/> Kontrol et</span></div></div> : <>
            <header className={styles.targetHeader}><button type="button" className={styles.mobileBack} onClick={clearTarget} aria-label="Alıcı listesine dön"><ArrowLeft size={20}/></button><span className={styles.avatar}>{selectedConversation ? initials(selectedConversation.name || selectedConversation.phone) : selectedGroup ? <Users size={20}/> : initials(selectedTargetName)}</span><div><h2>{selectedConversation ? selectedConversation.name || selectedConversation.phone : selectedTargetName}</h2><p>{selectedConversation ? selectedConversation.phone : selectedGroup ? `${estimatedRecipients} alıcı · Grup gönderimi` : selectedContact?.phone}</p></div><button type="button" className={styles.secondary} onClick={selectedConversation ? ()=>archiveConversation(selectedConversation.id) : clearTarget}>{selectedConversation ? <><Archive size={16}/><span>Arşivle</span></> : 'Alıcıyı değiştir'}</button></header>
            {selectedConversation ? <><div className={styles.chat}><div className={styles.chatMessages}>{conversationMessages.map(message=><div key={message.id} className={`${styles.bubble} ${message.direction==='inbound' ? styles.inbound : styles.outbound}`}><MessageContent message={message}/><time>{formatDate(message.created_at)}</time></div>)}{messagesLoading && <p role="status">Mesajlar yükleniyor…</p>}{messagesError && <p className={styles.error} role="alert">{messagesError}</p>}{!messagesLoading && !messagesError && !conversationMessages.length && <p className={styles.listEmpty}>Bu görüşmede henüz kayıtlı mesaj yok.</p>}</div></div>{msg && <p className={styles.feedback} role="status">{msg}</p>}<form className={styles.reply} onSubmit={event=>{event.preventDefault();void sendReply();}}><label className="sr-only" htmlFor="reply-text">Yanıtın</label><textarea id="reply-text" rows={2} value={replyText} onChange={event=>setReplyText(event.target.value)} placeholder="Yanıtını yaz…"/><button type="submit" className={styles.primary} disabled={replying || !replyText.trim()}><Send size={17}/>{replying ? 'Gönderiliyor…' : 'Gönder'}</button></form></> : <div className={styles.builder}>
              <div className={styles.editor}><section className={styles.card}><div className={styles.sectionHeading}><span className={styles.stepNumber}>1</span><div><h3>Mesajını hazırla</h3><p>Onaylı bir şablon seç ve gerekli alanları doldur.</p></div></div><button type="button" className={styles.templateChoice} onClick={()=>setTemplateModalOpen(true)}><FileText size={21}/><span><small>MESAJ ŞABLONU</small><strong>{selectedTemplate?.name || 'Bir şablon seç'}</strong><small>{selectedTemplate ? `${selectedTemplate.language} · Şablonu değiştirmek için tıkla` : 'Şablonları ve mesaj örneklerini görüntüle'}</small></span><ChevronDown size={17}/></button>
                {hasImageHeader && <div className={styles.formSection}><h4><ImagePlus size={17}/> Mesaj görseli</h4>{headerImageUrl ? <div className={styles.imageUpload}><img src={headerImageUrl} alt="Mesaja eklenen görsel"/><button type="button" className={styles.secondary} onClick={removePriceImage}>Görseli değiştir</button></div> : <label className={styles.upload}><ImagePlus size={27}/><strong>{uploading ? 'Görsel yükleniyor…' : 'Görsel ekle'}</strong><span>JPG veya PNG seç</span><input type="file" accept="image/png,image/jpeg,image/jpg" disabled={uploading} onChange={event=>{const file=event.target.files?.[0];if(file) void uploadImage(file);}}/></label>}</div>}
                {variableCount>0 && <div className={styles.formSection}><h4>Mesaj alanları</h4><p>Yazdıkların önizlemede görünecek.</p>{Array.from({length:variableCount}).map((_,index)=><label key={index} className={styles.field}><span>{index+1}. alan <small>{`{{${index+1}}}`}</small></span><input value={bodyVariables[index] || ''} onChange={event=>{const next=[...bodyVariables];next[index]=event.target.value;setBodyVariables(next);}} placeholder="Mesajdaki değeri yaz…"/></label>)}</div>}
              </section><section className={styles.deliveryNote}><Send size={18}/><div><strong>{selectedGroup ? 'Her alıcıya ayrı mesaj' : 'Seçtiğin kişiye gönderim'}</strong><p>{selectedGroup ? 'Mesajın grup üyelerine tek tek gönderilmek üzere sıraya alınır.' : 'Mesaj yalnızca seçtiğin kişiye gönderilir.'} Göndermeden önce son kez onaylayacaksın.</p></div></section>{msg && <p className={styles.feedback} role="status">{msg}</p>}</div>
              <section className={styles.previewCard} aria-label="Mesaj önizlemesi"><div className={styles.sectionHeading}><span className={styles.stepNumber}>2</span><div><h3>Önizlemeyi kontrol et</h3><p>Alıcının göreceği mesaj.</p></div></div><div className={styles.preview}><div className={`${styles.bubble} ${styles.outbound}`}>{hasImageHeader && headerImageUrl && <img src={headerImageUrl} alt="Gönderilecek görsel"/>}<p>{previewText || 'Şablonunu seçtiğinde mesajın burada görünecek.'}</p><time>Şimdi ✓✓</time></div></div><dl className={styles.summary}><div><dt>Alıcı</dt><dd>{selectedTargetName}</dd></div><div><dt>Gönderim</dt><dd>{typeof estimatedRecipients==='number' ? `${estimatedRecipients} kişi` : 'Grup üyeleri'}</dd></div><div><dt>Şablon</dt><dd>{selectedTemplate?.name || 'Seçilmedi'}</dd></div></dl><div className={styles.sendArea}><p className={readyToSend ? styles.ready : styles.requirement}>{readyToSend ? <><Check size={15}/> Mesajın kontrol için hazır</> : missing}</p><button type="button" className={styles.primary} onClick={()=>setConfirmOpen(true)} disabled={sending || uploading || !readyToSend}><Send size={17}/>{sending ? 'Hazırlanıyor…' : 'Kontrol et ve gönder'}</button></div></section>
            </div>}
          </>}
        </section>
      </div>
    </div>
    {templateModalOpen && <dialog ref={templateDialog} className={styles.templateDialog} aria-labelledby="template-title" onCancel={event=>{event.preventDefault();setTemplateModalOpen(false);}}><header className={styles.dialogHeader}><div><p className={styles.eyebrow}>MESAJ ŞABLONLARI</p><h2 id="template-title">Şablonunu seç</h2><p>Göndermek istediğin mesajın içeriğini kontrol et.</p></div><button type="button" className={styles.iconButton} onClick={()=>setTemplateModalOpen(false)} aria-label="Şablon seçimini kapat"><X size={20}/></button></header><label className={`${styles.search} ${styles.dialogSearch}`}><Search size={17}/><span className="sr-only">Şablon ara</span><input autoFocus value={templateSearch} onChange={event=>setTemplateSearch(event.target.value)} placeholder="Şablon adı veya mesaj içeriği ara…"/></label><div className={styles.templateGrid}>{filteredTemplates.map(t=>{const body=t.components?.find(c=>c.type?.toUpperCase()==='BODY')?.text || '';const image=t.components?.some(c=>c.type?.toUpperCase()==='HEADER' && c.format?.toUpperCase()==='IMAGE');const selected=selectedTemplateKey===`${t.name}__${t.language}`;return <button type="button" key={`${t.name}__${t.language}`} className={`${styles.templateOption} ${selected ? styles.chosen : ''}`} onClick={()=>{setSelectedTemplateKey(`${t.name}__${t.language}`);setTemplateModalOpen(false);if(pendingPriceImage && image && !headerImageUrl)void uploadImage(handoffFile(pendingPriceImage),true);}}><div><strong>{t.name}</strong>{selected ? <Check size={17}/> : <span>Seç</span>}</div><small>{t.language} · {image ? 'Görselli mesaj' : 'Metin mesajı'}{countVariables(body)>0 ? ` · ${countVariables(body)} alan` : ''}</small><p>{body || 'Mesaj içeriği bulunamadı.'}</p></button>})}{!filteredTemplates.length && <p className={styles.listEmpty}>Şablon bulunamadı.</p>}</div></dialog>}
    {confirmOpen && <SendConfirmation target={selectedTargetName || ''} recipients={estimatedRecipients} template={selectedTemplate?.name || ''} language={selectedTemplate?.language || ''} imageUrl={hasImageHeader ? headerImageUrl : ''} message={previewText} ready={Boolean(readyToSend)} sending={sending} onCancel={()=>setConfirmOpen(false)} onConfirm={()=>{setConfirmOpen(false);void send();}}/>}
  </main>;
}
