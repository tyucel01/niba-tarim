"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

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

function StatusPill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "emerald" | "amber" | "red" | "slate" }) {
  const styles = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    slate: "bg-slate-50 text-slate-600 ring-slate-100",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1 ${styles[tone]}`}>
      {children}
    </span>
  );
}

function PremiumCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-white/70 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

function StepBar({ hasTarget, hasTemplate, ready }: { hasTarget: boolean; hasTemplate: boolean; ready: boolean }) {
  const steps = [
    { label: "Hedef", done: hasTarget },
    { label: "Şablon", done: hasTemplate },
    { label: "Önizleme", done: hasTemplate },
    { label: "Onay", done: ready },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${step.done ? "bg-[#00a884] text-white" : "bg-slate-100 text-slate-400"}`}>
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className={`truncate text-xs font-black ${step.done ? "text-slate-900" : "text-slate-400"}`}>{step.label}</p>
            <p className="hidden text-[10px] text-slate-400 lg:block">{step.done ? "Tamam" : "Bekliyor"}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Page() {
  const router = useRouter();

  const [groups, setGroups] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [groupId, setGroupId] = useState("");
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");

  const [expandedWaiting, setExpandedWaiting] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(true);
  const [expandedContacts, setExpandedContacts] = useState(false);
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({});
  const [groupMembers, setGroupMembers] = useState<Record<string, GroupMember[]>>({});

  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);

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

  async function logout() {
    await supabase.auth.signOut();
    router.push("/admin");
  }

  async function loadGroups() {
    const res = await fetch(`/api/admin/whatsapp/groups?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    setGroups(data.groups || []);
  }

  async function loadContacts() {
    const res = await fetch(`/api/admin/whatsapp/contacts?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    if (data.success) setContacts(data.contacts || []);
  }

  async function loadConversations() {
    const res = await fetch(`/api/admin/whatsapp/conversations?t=${Date.now()}`, { cache: "no-store" });
    const data = await res.json();
    if (data.success) setConversations(data.conversations || []);
  }

  async function loadConversationMessages(conversationId: string) {
    const res = await fetch(`/api/admin/whatsapp/conversations/messages?conversationId=${conversationId}`);
    const data = await res.json();

    if (data.success) {
      setConversationMessages(data.messages || []);
    }
  }

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

  async function openConversation(conversation: Conversation) {
    setSelectedConversation(conversation);
    setSelectedContact(null);
    setGroupId("");
    setReplyText("");
    setMsg("");
    await loadConversationMessages(conversation.id);
  }

  async function loadTemplates() {
    const res = await fetch("/api/admin/whatsapp/templates");
    const data = await res.json();

    if (data.success) {
      setTemplates(data.templates || []);
      const first = data.templates?.[0];
      if (first) setSelectedTemplateKey(`${first.name}__${first.language}`);
    } else {
      setMsg("❌ Template listesi alınamadı: " + JSON.stringify(data.error));
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
  const readyToSend = hasTarget && !!selectedTemplate && (!hasImageHeader || !!headerImageUrl) && (variableCount === 0 || bodyVariables.every((v) => v.trim()));
  const selectedGroupMemberCount = selectedGroup?.member_count || selectedGroup?.contacts_count || selectedGroup?.count || groupMembers[groupId]?.length || 0;
  const estimatedRecipients = selectedGroup ? selectedGroupMemberCount || "Grup" : selectedContact ? 1 : 0;
  const totalUnread = conversations.reduce((sum, item) => sum + (item.unread_count || 0), 0);

  useEffect(() => {
    const values = Array.from({ length: variableCount }).map((_, index) => bodyVariables[index] || "");
    setBodyVariables(values);
  }, [selectedTemplateKey, variableCount]);

  useEffect(() => {
    if (!hasImageHeader) setHeaderImageUrl("");
  }, [hasImageHeader]);

  async function uploadImage(file: File) {
    try {
      setUploading(true);
      setMsg("Görsel yükleniyor...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/whatsapp/media/upload", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        setMsg("❌ Upload API JSON dönmedi: " + text.slice(0, 300));
        return;
      }

      if (data.success) {
        setHeaderImageUrl(data.url);
        setMsg("✅ Görsel yüklendi.");
      } else {
        setMsg("❌ Görsel yüklenemedi: " + JSON.stringify(data));
      }
    } catch (err) {
      setMsg("❌ Upload error: " + String(err));
    } finally {
      setUploading(false);
    }
  }

  async function send() {
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
          headerImageUrl: headerImageUrl || null,
          bodyVariables,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setMsg(`✅ Gönderim kuyruğa alındı. ${data.queued} kişi sıraya eklendi. Cron arka planda göndermeye devam edecek.`);
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

      await loadConversationMessages(selectedConversation.id);
      await loadConversations();
    } catch (err) {
      setMsg("❌ Cevap hatası: " + String(err));
    } finally {
      setReplying(false);
    }
  }

  async function archiveConversation(conversationId: string) {
    if (!confirm("Bu konuşma arşivlensin mi?")) return;

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
        setConversationMessages([]);
        setReplyText("");
      }

      setMsg("✅ Konuşma arşivlendi.");
      await loadConversations();
    } catch (err) {
      setMsg("❌ Arşivleme hatası: " + String(err));
    }
  }

  useEffect(() => {
    async function loadAll() {
      await loadGroups();
      await loadContacts();
      await loadTemplates();
      await loadConversations();
    }

    loadAll();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadGroups();
        loadContacts();
        loadConversations();
      }
    }, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#eef1ea] text-slate-900">
      <div className="md:hidden min-h-screen bg-[#f7f8f4]">
        {!selectedConversation && !groupId && !selectedContact ? (
          <div className="min-h-screen pb-6">
            <div className="sticky top-0 z-30 overflow-hidden bg-slate-950 px-5 pb-5 pt-4 text-white shadow-2xl">
              <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[#00a884]/30 blur-2xl" />
              <div className="absolute -bottom-16 left-10 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-emerald-200">Niba Tarım</p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight">WhatsApp Panel</h1>
                  <p className="mt-1 text-xs text-white/70">Kampanya, grup ve konuşma yönetimi</p>
                </div>
                <button type="button" onClick={logout} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold ring-1 ring-white/15 backdrop-blur">
                  Çıkış
                </button>
              </div>

              <div className="relative mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-xl font-black">{groups.length}</p>
                  <p className="text-[11px] text-white/65">Grup</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-xl font-black">{contacts.length}</p>
                  <p className="text-[11px] text-white/65">Kişi</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                  <p className="text-xl font-black">{totalUnread}</p>
                  <p className="text-[11px] text-white/65">Okunmamış</p>
                </div>
              </div>
            </div>

            <div className="px-4 pt-4">
              <div className="grid grid-cols-4 gap-2">
                <a href="/admin/whatsapp/gonder" className="rounded-2xl bg-slate-950 p-3 text-center text-xs font-black text-white shadow-lg shadow-slate-900/10">
                  <div className="text-xl">📤</div>
                  <div className="mt-1">Gönder</div>
                </a>
                <a href="/admin/whatsapp/raporlar" className="rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-sm ring-1 ring-slate-100">
                  <div className="text-xl">📊</div>
                  <div className="mt-1">Rapor</div>
                </a>
                <a href="/admin/whatsapp/gruplar" className="rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-sm ring-1 ring-slate-100">
                  <div className="text-xl">👥</div>
                  <div className="mt-1">Grup</div>
                </a>
                <a href="/admin/whatsapp/kisiler" className="rounded-2xl bg-white p-3 text-center text-xs font-bold shadow-sm ring-1 ring-slate-100">
                  <div className="text-xl">👤</div>
                  <div className="mt-1">Kişi</div>
                </a>
              </div>

              <PremiumCard className="mt-5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Konuşmalar</h2>
                    <p className="text-xs text-slate-400">Gelen cevapları buradan yönet</p>
                  </div>
                  <StatusPill tone="emerald">{conversations.length}</StatusPill>
                </div>

                <div className="divide-y divide-slate-100">
                  {conversations.map((conversation) => (
                    <div key={conversation.id} className="flex items-center gap-2 py-3">
                      <button type="button" onClick={() => openConversation(conversation)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a884] to-[#007f67] text-base font-black text-white shadow-lg shadow-emerald-900/10">
                          {initials(conversation.name || conversation.phone)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-black text-slate-900">{conversation.name || conversation.phone}</p>
                            {conversation.unread_count > 0 && <span className="rounded-full bg-[#00a884] px-2 py-0.5 text-xs font-black text-white">{conversation.unread_count}</span>}
                          </div>
                          <p className="truncate text-xs text-slate-500">{conversation.last_message || "-"}</p>
                        </div>
                      </button>
                      <button type="button" onClick={() => archiveConversation(conversation.id)} className="rounded-full bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 ring-1 ring-slate-100">
                        Arşivle
                      </button>
                    </div>
                  ))}
                  {conversations.length === 0 && <p className="py-3 text-sm text-slate-500">Konuşma yok.</p>}
                </div>
              </PremiumCard>

              <PremiumCard className="mt-4 p-4">
                <button type="button" onClick={() => setExpandedGroups((p) => !p)} className="flex w-full items-center justify-between text-left">
                  <span className="text-sm font-black uppercase tracking-wide text-slate-500">Gruplar</span>
                  <span className="text-lg font-black">{expandedGroups ? "−" : "+"}</span>
                </button>
                {expandedGroups && (
                  <div className="mt-3 divide-y divide-slate-100">
                    {groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setGroupId(g.id);
                          setSelectedContact(null);
                          setSelectedConversation(null);
                          setConversationMessages([]);
                          setMsg("");
                        }}
                        className="flex w-full items-center gap-3 py-3 text-left"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 font-black text-emerald-800 ring-1 ring-emerald-100">{initials(g.name)}</div>
                        <div>
                          <p className="font-black text-slate-900">{g.name}</p>
                          <p className="text-xs text-slate-500">Gruba template gönder</p>
                        </div>
                      </button>
                    ))}
                    {groups.length === 0 && <p className="py-3 text-sm text-slate-500">Henüz grup yok.</p>}
                  </div>
                )}
              </PremiumCard>

              <PremiumCard className="mt-4 p-4">
                <button type="button" onClick={() => setExpandedContacts((p) => !p)} className="flex w-full items-center justify-between text-left">
                  <span className="text-sm font-black uppercase tracking-wide text-slate-500">Kişiler</span>
                  <span className="text-lg font-black">{expandedContacts ? "−" : "+"}</span>
                </button>
                {expandedContacts && (
                  <div className="mt-3 divide-y divide-slate-100">
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setSelectedContact(contact);
                          setGroupId("");
                          setSelectedConversation(null);
                          setConversationMessages([]);
                          setMsg("");
                        }}
                        className="flex w-full items-center gap-3 py-3 text-left"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 font-black text-slate-700">{initials(contact.name || contact.phone)}</div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-900">{contact.name || "İsimsiz"}</p>
                          <p className="truncate text-xs text-slate-500">{contact.phone}</p>
                        </div>
                      </button>
                    ))}
                    {contacts.length === 0 && <p className="py-3 text-sm text-slate-500">Henüz kişi yok.</p>}
                  </div>
                )}
              </PremiumCard>
            </div>
          </div>
        ) : selectedConversation ? (
          <div className="flex min-h-screen flex-col bg-[#efeae2]">
            <div className="sticky top-0 z-30 flex items-center justify-between bg-slate-950 px-4 py-4 text-white shadow-xl">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConversation(null);
                    setConversationMessages([]);
                    setReplyText("");
                    setMsg("");
                  }}
                  className="text-2xl leading-none"
                >
                  ←
                </button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00a884] font-black shadow-lg shadow-emerald-900/20">
                  {initials(selectedConversation.name || selectedConversation.phone)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-black">{selectedConversation.name || selectedConversation.phone}</p>
                  <p className="text-xs text-white/70">Konuşma geçmişi</p>
                </div>
              </div>
              <button type="button" onClick={() => archiveConversation(selectedConversation.id)} className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold ring-1 ring-white/15">
                Arşivle
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {conversationMessages.map((message) => (
                <div key={message.id} className={`max-w-[82%] rounded-2xl p-3 text-sm shadow-sm ${message.direction === "inbound" ? "bg-white" : "ml-auto bg-[#d9fdd3]"}`}>
                  <p className="whitespace-pre-line text-slate-800">{message.message_text || "-"}</p>
                  <p className="mt-1 text-right text-[10px] text-slate-500">{formatDate(message.created_at)}</p>
                </div>
              ))}
              {conversationMessages.length === 0 && <div className="rounded-3xl bg-white p-6 text-center text-sm shadow-sm">Bu kişiyle henüz kayıtlı konuşma yok.</div>}
              {msg && <div className="rounded-2xl bg-white p-3 text-sm shadow-sm">{msg}</div>}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
              <div className="flex gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-100">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendReply();
                  }}
                  placeholder="Cevap yaz..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#00a884]"
                />
                <button type="button" onClick={sendReply} disabled={replying || !replyText.trim()} className="rounded-xl bg-[#00a884] px-4 py-3 font-black text-white disabled:opacity-50">
                  {replying ? "..." : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-screen flex-col bg-[#f7f8f4]">
            <div className="sticky top-0 z-30 flex items-center gap-3 bg-slate-950 px-4 py-4 text-white shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setGroupId("");
                  setSelectedContact(null);
                  setSelectedConversation(null);
                  setMsg("");
                }}
                className="text-2xl leading-none"
              >
                ←
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#00a884] font-black shadow-lg shadow-emerald-900/20">
                {initials(selectedTargetName)}
              </div>
              <div>
                <p className="font-black">{selectedTargetName || "Mesaj Gönder"}</p>
                <p className="text-xs text-white/70">Campaign Builder</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <StepBar hasTarget={hasTarget} hasTemplate={!!selectedTemplate} ready={readyToSend} />

              <PremiumCard className="p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Hedef</p>
                    <h2 className="mt-1 text-lg font-black text-slate-950">{selectedTargetName}</h2>
                    <p className="mt-1 text-xs text-slate-500">{selectedGroup ? "Grup kampanyası" : "Tekil kişi gönderimi"}</p>
                  </div>
                  <StatusPill tone="emerald">{estimatedRecipients} kişi</StatusPill>
                </div>

                <button type="button" onClick={() => setTemplateModalOpen(true)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-[#00a884] hover:shadow-md">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Meta Template</div>
                  <div className="mt-1 font-black text-slate-900">{selectedTemplate ? `${selectedTemplate.name} — ${selectedTemplate.language}` : "Template seç"}</div>
                  <div className="mt-1 text-xs text-slate-500">Template’i seç, değişkenleri doldur, WhatsApp önizlemesini kontrol et.</div>
                </button>

                {hasImageHeader && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Header Görseli</label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage(file);
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                    />
                    {uploading && <p className="mt-2 text-sm text-slate-500">Görsel yükleniyor...</p>}
                    {headerImageUrl && <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">✅ Görsel yüklendi</div>}
                  </div>
                )}

                {variableCount > 0 && (
                  <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">Değişkenler</div>
                      <p className="mt-1 text-xs text-slate-400">Boş alan kalırsa gönderim başlatılmaz.</p>
                    </div>
                    {Array.from({ length: variableCount }).map((_, index) => (
                      <input
                        key={index}
                        value={bodyVariables[index] || ""}
                        onChange={(e) => {
                          const next = [...bodyVariables];
                          next[index] = e.target.value;
                          setBodyVariables(next);
                        }}
                        placeholder={`{{${index + 1}}} değeri`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
                      />
                    ))}
                  </div>
                )}
              </PremiumCard>

              <div className="rounded-[28px] bg-[#efeae2] p-4 shadow-inner ring-1 ring-black/5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">WhatsApp Önizleme</p>
                  <StatusPill tone={readyToSend ? "emerald" : "amber"}>{readyToSend ? "Hazır" : "Eksik"}</StatusPill>
                </div>
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 text-sm shadow-lg shadow-black/5">
                  {headerImageUrl && <img src={headerImageUrl} alt="Header görseli" className="mb-3 max-h-64 w-full rounded-xl object-cover" />}
                  <p className="whitespace-pre-line leading-6 text-slate-800">{previewText || selectedTemplate?.name || "Şablon seç"}</p>
                  <p className="mt-2 text-right text-[11px] text-slate-500">Şimdi · {selectedTemplate?.language || ""}</p>
                </div>
              </div>

              {selectedGroup && (
                <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800 ring-1 ring-amber-100">
                  ⚠️ Aynı gruba kısa sürede çok sık mesaj göndermemeye dikkat edin. Mesajlar cron ile arka planda sırayla gönderilir.
                </div>
              )}

              {msg && <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-100">{msg}</div>}
            </div>

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={sending || uploading || !readyToSend}
                className="w-full rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-5 py-4 font-black text-white shadow-xl shadow-emerald-900/15 disabled:opacity-50"
              >
                {sending ? "Kuyruğa alınıyor..." : "🚀 Kampanyayı Başlat"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:flex md:h-screen md:overflow-hidden md:bg-[#eef1ea]">
        <aside className="w-[420px] shrink-0 border-r border-slate-200/80 bg-white/80 shadow-2xl shadow-slate-900/5 backdrop-blur">
          <div className="relative overflow-hidden bg-slate-950 px-6 py-6 text-white">
            <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#00a884]/30 blur-3xl" />
            <div className="absolute -bottom-20 left-12 h-40 w-40 rounded-full bg-emerald-300/15 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-200">Niba Tarım</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight">WhatsApp Center</h1>
                <p className="mt-1 text-sm text-white/65">B2B kampanya ve görüşme yönetimi</p>
              </div>
              <button type="button" onClick={logout} className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/15">
                Çıkış
              </button>
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <p className="text-2xl font-black">{groups.length}</p>
                <p className="text-xs text-white/60">Grup</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <p className="text-2xl font-black">{contacts.length}</p>
                <p className="text-xs text-white/60">Kişi</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                <p className="text-2xl font-black">{totalUnread}</p>
                <p className="text-xs text-white/60">Okunmamış</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 border-b border-slate-200 p-4">
            <a href="/admin/whatsapp/gonder" title="Gönder" className="flex flex-col items-center justify-center rounded-2xl bg-slate-950 px-2 py-3 text-xs font-black text-white shadow-lg shadow-slate-900/10">
              <span className="text-lg">📤</span>
              <span className="mt-1">Gönder</span>
            </a>
            <a href="/admin/whatsapp/raporlar" title="Raporlar" className="flex flex-col items-center justify-center rounded-2xl bg-white px-2 py-3 text-xs font-bold shadow-sm ring-1 ring-slate-100 hover:bg-emerald-50">
              <span className="text-lg">📊</span>
              <span className="mt-1">Rapor</span>
            </a>
            <a href="/admin/whatsapp/gruplar" title="Gruplar" className="flex flex-col items-center justify-center rounded-2xl bg-white px-2 py-3 text-xs font-bold shadow-sm ring-1 ring-slate-100 hover:bg-emerald-50">
              <span className="text-lg">👥</span>
              <span className="mt-1">Grup</span>
            </a>
            <a href="/admin/whatsapp/kisiler" title="Kişiler" className="flex flex-col items-center justify-center rounded-2xl bg-white px-2 py-3 text-xs font-bold shadow-sm ring-1 ring-slate-100 hover:bg-emerald-50">
              <span className="text-lg">👤</span>
              <span className="mt-1">Kişi</span>
            </a>
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto px-3 py-4">
            <button type="button" onClick={() => setExpandedWaiting((prev) => !prev)} className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50">
              <span>Konuşmalar</span>
              <span className="text-lg">{expandedWaiting ? "−" : "+"}</span>
            </button>

            {expandedWaiting && (
              <div className="mt-1 space-y-2">
                {conversations.map((conversation) => (
                  <div key={conversation.id} className={`flex w-full items-center gap-2 rounded-3xl px-3 py-3 transition hover:bg-white hover:shadow-sm ${selectedConversation?.id === conversation.id ? "bg-white shadow-sm ring-1 ring-emerald-100" : ""}`}>
                    <button type="button" onClick={() => openConversation(conversation)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00a884] to-[#007f67] font-black text-white shadow-lg shadow-emerald-900/10">
                        {initials(conversation.name || conversation.phone)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-black text-slate-900">{conversation.name || conversation.phone}</div>
                          {conversation.unread_count > 0 && <span className="rounded-full bg-[#00a884] px-2 py-0.5 text-xs font-black text-white">{conversation.unread_count}</span>}
                        </div>
                        <div className="truncate text-xs text-slate-500">{conversation.last_message || "-"}</div>
                      </div>
                    </button>
                    <button type="button" title="Arşivle" onClick={() => archiveConversation(conversation.id)} className="rounded-full px-2 py-1 text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-red-600">
                      Arşivle
                    </button>
                  </div>
                ))}

                {conversations.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">Konuşma yok.</div>}
              </div>
            )}

            <button type="button" onClick={() => setExpandedGroups((prev) => !prev)} className="mt-3 flex w-full items-center justify-between rounded-2xl border-t border-slate-100 px-3 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50">
              <span>Gruplar</span>
              <span className="text-lg">{expandedGroups ? "−" : "+"}</span>
            </button>

            {expandedGroups && (
              <div className="mt-1 space-y-2">
                {groups.map((g) => {
                  const isOpen = !!openGroupIds[g.id];
                  const members = groupMembers[g.id] || [];

                  return (
                    <div key={g.id} className={`overflow-hidden rounded-3xl transition ${groupId === g.id ? "bg-white shadow-sm ring-1 ring-emerald-100" : "hover:bg-white/70"}`}>
                      <div className="flex items-center gap-2 px-3 py-3">
                        <button type="button" onClick={() => toggleGroup(g.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-600">
                          {isOpen ? "−" : "+"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setGroupId(g.id);
                            setSelectedContact(null);
                            setSelectedConversation(null);
                            setConversationMessages([]);
                            setMsg("");
                          }}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 font-black text-emerald-800 ring-1 ring-emerald-100">{initials(g.name)}</div>
                          <div className="min-w-0">
                            <div className="truncate font-black text-slate-900">{g.name}</div>
                            <div className="text-xs text-slate-500">Kampanya grubu</div>
                          </div>
                        </button>
                      </div>

                      {isOpen && (
                        <div className="bg-slate-50/80 py-2 pl-16 pr-3">
                          {members.length === 0 ? (
                            <div className="py-2 text-xs text-slate-400">Bu grupta kişi yok</div>
                          ) : (
                            members.map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => {
                                  const contact = member.whatsapp_contacts;
                                  if (!contact) return;
                                  setSelectedContact(contact);
                                  setGroupId("");
                                  setSelectedConversation(null);
                                  setConversationMessages([]);
                                  setMsg("");
                                }}
                                className={`mb-1 block w-full min-w-0 rounded-2xl px-3 py-2 text-left text-sm hover:bg-white ${selectedContact?.id === member.whatsapp_contacts?.id ? "bg-white" : ""}`}
                              >
                                <div className="truncate font-bold text-slate-800">{member.whatsapp_contacts?.name || "İsimsiz"}</div>
                                <div className="truncate text-xs text-slate-500">{member.whatsapp_contacts?.phone || "-"}</div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {groups.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">Henüz grup yok.</div>}
              </div>
            )}

            <button type="button" onClick={() => setExpandedContacts((prev) => !prev)} className="mt-3 flex w-full items-center justify-between rounded-2xl border-t border-slate-100 px-3 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500 hover:bg-slate-50">
              <span>Kişiler</span>
              <span className="text-lg">{expandedContacts ? "−" : "+"}</span>
            </button>

            {expandedContacts && (
              <div className="mt-1 space-y-2">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      setSelectedContact(contact);
                      setGroupId("");
                      setSelectedConversation(null);
                      setConversationMessages([]);
                      setMsg("");
                    }}
                    className={`flex w-full items-center gap-3 rounded-3xl px-3 py-3 text-left hover:bg-white ${selectedContact?.id === contact.id ? "bg-white shadow-sm ring-1 ring-emerald-100" : ""}`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 font-black text-slate-700">{initials(contact.name || contact.phone)}</div>
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-800">{contact.name || "İsimsiz"}</div>
                      <div className="truncate text-xs text-slate-500">{contact.phone}</div>
                    </div>
                  </button>
                ))}

                {contacts.length === 0 && <div className="px-4 py-3 text-sm text-slate-500">Henüz kişi yok.</div>}
              </div>
            )}
          </div>
        </aside>

        <section className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200/80 bg-white/70 px-8 py-4 backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-[#00a884] to-[#007f67] text-lg font-black text-white shadow-xl shadow-emerald-900/10">
                  {selectedConversation ? initials(selectedConversation.name || selectedConversation.phone) : initials(selectedTargetName)}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">WhatsApp Campaign Builder</p>
                  <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950">
                    {selectedConversation ? selectedConversation.name || selectedConversation.phone : selectedTargetName || "Grup veya kişi seçilmedi"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedConversation ? "Konuşma geçmişi" : selectedTargetName ? selectedContact ? "Kişiye template gönder" : "Gruba template gönder" : "Mesaj göndermek için soldan grup veya kişi seç"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedConversation && (
                  <button type="button" onClick={() => archiveConversation(selectedConversation.id)} className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-100 hover:bg-red-50 hover:text-red-600">
                    Arşivle
                  </button>
                )}
                {!selectedConversation && hasTarget && <StatusPill tone="emerald">{estimatedRecipients} kişi</StatusPill>}
              </div>
            </div>
          </header>

          {selectedConversation ? (
            <>
              <div
                className="min-h-0 flex-1 overflow-y-auto p-6"
                style={{
                  backgroundColor: "#efeae2",
                  backgroundImage: "radial-gradient(circle at 25px 25px, rgba(0,0,0,0.035) 2px, transparent 0)",
                  backgroundSize: "46px 46px",
                }}
              >
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                  {conversationMessages.map((message) => (
                    <div key={message.id} className={`max-w-xl rounded-3xl p-4 text-sm shadow-lg shadow-black/5 ${message.direction === "inbound" ? "self-start bg-white" : "self-end bg-[#d9fdd3]"}`}>
                      <p className="whitespace-pre-line leading-6 text-slate-800">{message.message_text || "-"}</p>
                      <p className="mt-2 text-right text-[11px] text-slate-500">{formatDate(message.created_at)}</p>
                    </div>
                  ))}

                  {conversationMessages.length === 0 && (
                    <div className="rounded-[28px] bg-white p-10 text-center shadow-xl shadow-black/5">
                      <div className="text-4xl">💬</div>
                      <h3 className="mt-4 text-lg font-black text-slate-900">Konuşma yok</h3>
                      <p className="mt-2 text-sm text-slate-500">Bu kişiyle henüz kayıtlı konuşma yok.</p>
                    </div>
                  )}

                  {msg && <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm">{msg}</div>}
                </div>
              </div>

              <footer className="shrink-0 border-t border-slate-200 bg-white/80 p-3 pb-4 backdrop-blur">
                <div className="mx-auto flex max-w-4xl gap-2 rounded-3xl bg-white p-2 shadow-xl shadow-slate-900/5 ring-1 ring-slate-100">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendReply();
                    }}
                    placeholder="Cevap yaz..."
                    className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
                  />

                  <button type="button" onClick={sendReply} disabled={replying || !replyText.trim()} className="rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-6 py-4 font-black text-white shadow-lg shadow-emerald-900/10 disabled:opacity-50">
                    {replying ? "Gönderiliyor..." : "Gönder"}
                  </button>
                </div>
              </footer>
            </>
          ) : !groupId && !selectedContact ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-xl rounded-[36px] bg-white p-10 shadow-2xl shadow-slate-900/5 ring-1 ring-slate-100">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-50 text-4xl ring-1 ring-emerald-100">💬</div>
                <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-950">Gönderime başlamak için hedef seçin</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">Soldaki panelden bir grup veya kişi seçtiğinizde template, değişken ve WhatsApp önizleme alanı açılır.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <div className="mx-auto max-w-6xl space-y-5">
                  <StepBar hasTarget={hasTarget} hasTemplate={!!selectedTemplate} ready={readyToSend} />

                  <div className="grid gap-5 xl:grid-cols-[1fr_430px]">
                    <div className="space-y-5">
                      <PremiumCard className="p-6">
                        <div className="mb-5 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Hedef</p>
                            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{selectedTargetName}</h3>
                            <p className="mt-1 text-sm text-slate-500">{selectedGroup ? "Grup kampanyası olarak kuyruğa alınacak" : "Tekil kişi gönderimi"}</p>
                          </div>
                          <StatusPill tone="emerald">{estimatedRecipients} kişi</StatusPill>
                        </div>

                        <div className="mt-2 text-sm text-slate-500">
  Bu kampanya seçili gruba WhatsApp üzerinden toplu olarak gönderilecektir.
</div>
</PremiumCard>

                      <PremiumCard className="p-6">
                        <div className="mb-4">
                          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Mesaj İçeriği</p>
                          <h3 className="mt-2 text-xl font-black text-slate-950">Template ve değişkenler</h3>
                        </div>

                        <button type="button" onClick={() => setTemplateModalOpen(true)} className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition hover:border-[#00a884] hover:shadow-lg hover:shadow-emerald-900/5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Meta Template</div>
                              <div className="mt-1 text-lg font-black text-slate-900">{selectedTemplate ? `${selectedTemplate.name} — ${selectedTemplate.language}` : "Template seç"}</div>
                              <div className="mt-1 text-sm text-slate-500">Tıklayınca template önizleme ekranı açılır.</div>
                            </div>
                            <StatusPill tone={selectedTemplate ? "emerald" : "amber"}>{selectedTemplate ? "Seçili" : "Seç"}</StatusPill>
                          </div>
                        </button>

                        {hasImageHeader && (
                          <div className="mt-5 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-100">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Header Görseli</label>
                                <p className="mt-1 text-xs text-slate-400">Bu template görsel header bekliyor.</p>
                              </div>
                              {headerImageUrl && <StatusPill tone="emerald">Yüklendi</StatusPill>}
                            </div>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg"
                              disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadImage(file);
                              }}
                              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                            />

                            {uploading && <p className="mt-2 text-sm text-slate-500">Görsel yükleniyor...</p>}

                            {headerImageUrl && (
                              <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 ring-1 ring-emerald-100">
                                <span>✅ Görsel yüklendi</span>
                                <button type="button" onClick={() => setHeaderImageUrl("")} className="font-black text-emerald-900 underline">
                                  Kaldır
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {variableCount > 0 && (
                          <div className="mt-5 rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-100">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <div className="text-xs font-black uppercase tracking-wide text-slate-500">Değişkenler</div>
                                <p className="mt-1 text-xs text-slate-400">Template içindeki alanları doldurun.</p>
                              </div>
                              <StatusPill tone="slate">{variableCount} alan</StatusPill>
                            </div>

                            <div className="space-y-3">
                              {Array.from({ length: variableCount }).map((_, index) => (
                                <input
                                  key={index}
                                  value={bodyVariables[index] || ""}
                                  onChange={(e) => {
                                    const next = [...bodyVariables];
                                    next[index] = e.target.value;
                                    setBodyVariables(next);
                                  }}
                                  placeholder={`{{${index + 1}}} değeri`}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none transition focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </PremiumCard>

                      {selectedGroup && (
                        <div className="rounded-3xl bg-amber-50 p-5 text-sm font-semibold leading-6 text-amber-800 ring-1 ring-amber-100">
                          ⚠️ Mesajlar kuyruğa alınır ve cron tarafından arka planda gönderilir. Aynı gruba kısa sürede çok sık gönderim yapmamaya dikkat edin.
                        </div>
                      )}

                      {msg && <div className="rounded-3xl bg-white p-5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-100">{msg}</div>}
                    </div>

                    <div className="xl:sticky xl:top-6 xl:self-start">
                      <div className="rounded-[32px] bg-[#efeae2] p-5 shadow-2xl shadow-slate-900/10 ring-1 ring-black/5">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Önizleme</p>
                            <h3 className="mt-1 text-lg font-black text-slate-950">WhatsApp görünümü</h3>
                          </div>
                          <StatusPill tone={readyToSend ? "emerald" : "amber"}>{readyToSend ? "Hazır" : "Eksik"}</StatusPill>
                        </div>

                        <div className="flex justify-end">
                          <div className="relative max-w-sm rounded-3xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-xl shadow-black/5">
                            {headerImageUrl && <img src={headerImageUrl} alt="Gönderilecek görsel" className="mb-3 max-h-72 w-full rounded-2xl object-cover" />}
                            <p className="whitespace-pre-line text-sm leading-6 text-slate-800">{previewText || selectedTemplate?.name || "Şablon seç"}</p>
                            <p className="mt-3 text-right text-[11px] text-slate-500">Şimdi · {selectedTemplate?.language || ""}</p>
                          </div>
                        </div>

                        <div className="mt-5 rounded-3xl bg-white/70 p-4 ring-1 ring-white/70">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-500">Hedef</span>
                            <span className="font-black text-slate-900">{selectedTargetName}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-500">Alıcı</span>
                            <span className="font-black text-slate-900">{estimatedRecipients}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="font-bold text-slate-500">Template</span>
                            <span className="max-w-[190px] truncate font-black text-slate-900">{selectedTemplate?.name || "-"}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setConfirmOpen(true)}
                          disabled={sending || uploading || !readyToSend}
                          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-5 py-4 font-black text-white shadow-xl shadow-emerald-900/15 transition hover:scale-[1.01] disabled:scale-100 disabled:opacity-50"
                        >
                          {sending ? "Kuyruğa alınıyor..." : "🚀 Kampanyayı Başlat"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-4">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="shrink-0 border-b border-slate-200 px-5 py-5 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Meta Template Library</p>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Template Seç</h2>
                  <p className="mt-1 text-sm text-slate-500">Template adını, dilini veya mesaj içeriğini arayabilirsin.</p>
                </div>

                <button type="button" onClick={() => setTemplateModalOpen(false)} className="rounded-full bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-200">
                  Kapat
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Template ara... örn: fiyat, can, kampanya"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00a884] focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => setTemplateSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-200"
                    >
                      Temizle
                    </button>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                    {filteredTemplates.length} template
                  </span>
                  {selectedTemplate && (
                    <span className="hidden rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200 md:inline-flex">
                      Seçili: {selectedTemplate.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 md:p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map((t) => {
                  const body = t.components?.find((c) => c.type?.toUpperCase() === "BODY")?.text || "";
                  const header = t.components?.find((c) => c.type?.toUpperCase() === "HEADER");
                  const isImageHeader = header?.format?.toUpperCase() === "IMAGE";
                  const key = `${t.name}__${t.language}`;
                  const isSelected = selectedTemplateKey === key;
                  const variableCountForTemplate = countVariables(body);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateKey(key);
                        setTemplateModalOpen(false);
                        setTemplateSearch("");
                      }}
                      className={`group flex h-full flex-col rounded-[24px] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${
                        isSelected
                          ? "border-[#00a884] bg-emerald-50 shadow-lg shadow-emerald-900/5"
                          : "border-slate-200 bg-white hover:border-[#00a884]"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-black text-slate-950">{t.name}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{t.language}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{t.category || "Kategori yok"}</span>
                            {isImageHeader && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">Görsel</span>}
                            {variableCountForTemplate > 0 && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black text-blue-700">{variableCountForTemplate} değişken</span>}
                          </div>
                        </div>

                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${isSelected ? "bg-[#00a884] text-white" : "bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700"}`}>
                          {isSelected ? "Seçili" : "Seç"}
                        </span>
                      </div>

                      <div className="flex-1 rounded-3xl bg-[#efeae2] p-3 ring-1 ring-black/5">
                        <div className="ml-auto max-w-sm rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-3 shadow-sm">
                          {isImageHeader && <div className="mb-3 flex h-24 items-center justify-center rounded-2xl bg-slate-200 text-xs font-bold text-slate-500">Header görsel alanı</div>}
                          <p className="line-clamp-6 whitespace-pre-line text-xs leading-5 text-slate-800">{body || "Body içeriği yok"}</p>
                          <p className="mt-2 text-right text-[10px] text-slate-500">{t.language}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="rounded-[28px] bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
                  <div className="text-4xl">🔎</div>
                  <h3 className="mt-4 text-lg font-black text-slate-950">Template bulunamadı</h3>
                  <p className="mt-2 text-sm text-slate-500">Arama kelimesini değiştirerek tekrar deneyebilirsin.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Son Kontrol</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Gönderimi Onayla</h2>
                <p className="mt-1 text-sm text-slate-500">Mesajlar kuyruğa alınacak ve cron arka planda gönderecek.</p>
              </div>
              <StatusPill tone={readyToSend ? "emerald" : "amber"}>{readyToSend ? "Hazır" : "Eksik"}</StatusPill>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-400">Hedef</p>
                <p className="mt-1 truncate font-black text-slate-900">{selectedTargetName || "-"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-400">Alıcı</p>
                <p className="mt-1 font-black text-slate-900">{estimatedRecipients || "-"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-400">Template</p>
                <p className="mt-1 truncate font-black text-slate-900">{selectedTemplate?.name || "-"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                <p className="text-xs font-bold text-slate-400">Görsel</p>
                <p className="mt-1 font-black text-slate-900">{headerImageUrl ? "Var" : "Yok"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-[#efeae2] p-4">
              <div className="ml-auto max-w-sm rounded-3xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm">
                {headerImageUrl && <img src={headerImageUrl} alt="Gönderilecek görsel" className="mb-3 max-h-72 w-full rounded-2xl object-contain" />}
                <p className="whitespace-pre-line text-sm leading-6 text-slate-800">{previewText || selectedTemplate?.name || "Şablon seç"}</p>
                <p className="mt-2 text-right text-[11px] text-slate-500">Şimdi</p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 rounded-2xl bg-slate-100 py-3 font-black text-slate-700 hover:bg-slate-200">
                Vazgeç
              </button>

              <button
                type="button"
                disabled={sending || !readyToSend}
                onClick={async () => {
                  setConfirmOpen(false);
                  await send();
                }}
                className="flex-1 rounded-2xl bg-gradient-to-r from-[#00a884] to-[#00c297] py-3 font-black text-white shadow-xl shadow-emerald-900/15 disabled:opacity-50"
              >
                {sending ? "Kuyruğa alınıyor..." : "Gönderimi Başlat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
