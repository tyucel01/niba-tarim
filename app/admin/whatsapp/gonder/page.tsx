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

  const [expandedWaiting, setExpandedWaiting] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(true);
  const [expandedContacts, setExpandedContacts] = useState(false);
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({});
  const [groupMembers, setGroupMembers] = useState<
    Record<string, GroupMember[]>
  >({});

  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
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
    const res = await fetch(`/api/admin/whatsapp/groups?t=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    setGroups(data.groups || []);
  }

  async function loadContacts() {
    const res = await fetch(`/api/admin/whatsapp/contacts?t=${Date.now()}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (data.success) setContacts(data.contacts || []);
  }

  async function loadConversations() {
    const res = await fetch(
      `/api/admin/whatsapp/conversations?t=${Date.now()}`,
      {
        cache: "no-store",
      },
    );
    const data = await res.json();
    if (data.success) setConversations(data.conversations || []);
  }

  async function loadConversationMessages(conversationId: string) {
    const res = await fetch(
      `/api/admin/whatsapp/conversations/messages?conversationId=${conversationId}`,
    );
    const data = await res.json();

    if (data.success) {
      setConversationMessages(data.messages || []);
    }
  }

  async function loadGroupMembers(targetGroupId: string) {
    const res = await fetch(
      `/api/admin/whatsapp/group-members?groupId=${targetGroupId}`,
    );
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
  const selectedTargetName =
    selectedGroup?.name ||
    selectedContact?.name ||
    selectedContact?.phone ||
    "";

  const selectedTemplate = useMemo(() => {
    return templates.find(
      (t) => `${t.name}__${t.language}` === selectedTemplateKey,
    );
  }, [templates, selectedTemplateKey]);

  const bodyText =
    selectedTemplate?.components?.find((c) => c.type?.toUpperCase() === "BODY")
      ?.text || "";

  const headerComponent = selectedTemplate?.components?.find(
    (c) => c.type?.toUpperCase() === "HEADER",
  );

  const hasImageHeader = headerComponent?.format?.toUpperCase() === "IMAGE";
  const variableCount = countVariables(bodyText);
  const previewText = replaceVariables(bodyText, bodyVariables);

  useEffect(() => {
    const values = Array.from({ length: variableCount }).map(
      (_, index) => bodyVariables[index] || "",
    );
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
        setMsg(
          `✅ Gönderim kuyruğa alındı. ${data.queued} kişi sıraya eklendi.`,
        );
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
    <main className="min-h-screen bg-[#d9dbd5] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl overflow-hidden bg-[#f0f2f5] shadow-2xl">
        <aside className="w-96 border-r border-slate-300 bg-[#f0f2f5]">
          <div className="flex items-center justify-between bg-[#00a884] px-5 py-4 text-white">
            <div>
              <h1 className="text-lg font-semibold">WhatsApp</h1>
              <p className="text-xs text-white/80">Admin Panel</p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-white/20 px-3 py-2 text-xs font-semibold"
            >
              Çıkış
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 border-b border-slate-200 p-3">
            <a
              href="/admin/whatsapp/raporlar"
              title="Raporlar"
              className="flex flex-col items-center justify-center rounded-xl bg-white px-2 py-3 text-xs font-semibold shadow-sm hover:bg-emerald-50"
            >
              <span className="text-lg">📊</span>
              <span className="mt-1">Rapor</span>
            </a>

            <a
              href="/admin/whatsapp/gruplar"
              title="Gruplar"
              className="flex flex-col items-center justify-center rounded-xl bg-white px-2 py-3 text-xs font-semibold shadow-sm hover:bg-emerald-50"
            >
              <span className="text-lg">👥</span>
              <span className="mt-1">Grup</span>
            </a>

            <a
              href="/admin/whatsapp/kisiler"
              title="Kişiler"
              className="flex flex-col items-center justify-center rounded-xl bg-white px-2 py-3 text-xs font-semibold shadow-sm hover:bg-emerald-50"
            >
              <span className="text-lg">👤</span>
              <span className="mt-1">Kişi</span>
            </a>

            <a
              href="/admin/whatsapp/ayarlar"
              title="Ayarlar"
              className="flex flex-col items-center justify-center rounded-xl bg-white px-2 py-3 text-xs font-semibold shadow-sm hover:bg-emerald-50"
            >
              <span className="text-lg">⚙️</span>
              <span className="mt-1">Ayar</span>
            </a>
          </div>

          <div className="max-h-[calc(100vh-205px)] overflow-y-auto">
            <button
              type="button"
              onClick={() => setExpandedWaiting((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 hover:bg-white/60"
            >
              <span>Konuşmalar</span>
              <span className="text-lg">{expandedWaiting ? "−" : "+"}</span>
            </button>

            {expandedWaiting && (
              <div className="divide-y divide-slate-200 bg-white/60">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`flex w-full items-center gap-2 px-4 py-3 hover:bg-white ${
                      selectedConversation?.id === conversation.id
                        ? "bg-white"
                        : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openConversation(conversation)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] font-semibold text-white">
                        {(conversation.name || conversation.phone)
                          ?.slice(0, 1)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate font-medium text-slate-900">
                            {conversation.name || conversation.phone}
                          </div>

                          {conversation.unread_count > 0 && (
                            <span className="rounded-full bg-[#00a884] px-2 py-0.5 text-xs font-bold text-white">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>

                        <div className="truncate text-xs text-slate-500">
                          {conversation.last_message || "-"}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      title="Arşivle"
                      onClick={() => archiveConversation(conversation.id)}
                      className="rounded-full px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600"
                    >
                      Arşivle
                    </button>
                  </div>
                ))}

                {conversations.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    Konuşma yok.
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpandedGroups((prev) => !prev)}
              className="mt-2 flex w-full items-center justify-between border-t border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 hover:bg-white/60"
            >
              <span>Gruplar</span>
              <span className="text-lg">{expandedGroups ? "−" : "+"}</span>
            </button>

            {expandedGroups && (
              <div className="divide-y divide-slate-200">
                {groups.map((g) => {
                  const isOpen = !!openGroupIds[g.id];
                  const members = groupMembers[g.id] || [];

                  return (
                    <div key={g.id}>
                      <div
                        className={`flex items-center gap-2 px-3 py-2 ${
                          groupId === g.id ? "bg-white" : "hover:bg-white/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-sm font-bold"
                        >
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
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] font-semibold text-white">
                            {g.name?.slice(0, 1).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">
                              {g.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              Kampanya grubu
                            </div>
                          </div>
                        </button>
                      </div>

                      {isOpen && (
                        <div className="bg-white/70 py-1 pl-16 pr-3">
                          {members.length === 0 ? (
                            <div className="py-2 text-xs text-slate-400">
                              Bu grupta kişi yok
                            </div>
                          ) : (
                            members.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2"
                              >
                                <button
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
                                  className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm hover:bg-white ${
                                    selectedContact?.id ===
                                    member.whatsapp_contacts?.id
                                      ? "bg-white"
                                      : ""
                                  }`}
                                >
                                  <div className="truncate font-medium text-slate-800">
                                    {member.whatsapp_contacts?.name ||
                                      "İsimsiz"}
                                  </div>
                                  <div className="truncate text-xs text-slate-500">
                                    {member.whatsapp_contacts?.phone || "-"}
                                  </div>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {groups.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    Henüz grup yok.
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpandedContacts((prev) => !prev)}
              className="mt-2 flex w-full items-center justify-between border-t border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500 hover:bg-white/60"
            >
              <span>Kişiler</span>
              <span className="text-lg">{expandedContacts ? "−" : "+"}</span>
            </button>

            {expandedContacts && (
              <div className="bg-white/60">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-2 border-t border-slate-100 px-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContact(contact);
                        setGroupId("");
                        setSelectedConversation(null);
                        setConversationMessages([]);
                        setMsg("");
                      }}
                      className={`min-w-0 flex-1 text-left text-sm hover:bg-white ${
                        selectedContact?.id === contact.id ? "bg-white" : ""
                      }`}
                    >
                      <div className="font-medium text-slate-800">
                        {contact.name || "İsimsiz"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {contact.phone}
                      </div>
                    </button>
                  </div>
                ))}

                {contacts.length === 0 && (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    Henüz kişi yok.
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        <section className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-300 bg-[#f0f2f5] px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] font-semibold text-white">
                {selectedConversation
                  ? (selectedConversation.name || selectedConversation.phone)
                      ?.slice(0, 1)
                      .toUpperCase()
                  : selectedTargetName?.slice(0, 1).toUpperCase() || "?"}
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  {selectedConversation
                    ? selectedConversation.name || selectedConversation.phone
                    : selectedTargetName || "Grup veya kişi seçilmedi"}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedConversation
                    ? "Konuşma geçmişi"
                    : selectedTargetName
                      ? selectedContact
                        ? "Kişiye template gönder"
                        : "Gruba template gönder"
                      : "Mesaj göndermek için soldan grup veya kişi seç"}
                </p>
              </div>
            </div>

            {selectedConversation && (
              <button
                type="button"
                onClick={() => archiveConversation(selectedConversation.id)}
                className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-600"
              >
                Arşivle
              </button>
            )}
          </header>

          {selectedConversation ? (
            <>
              <div
                className="flex-1 overflow-y-auto p-6"
                style={{
                  backgroundColor: "#efeae2",
                  backgroundImage:
                    "radial-gradient(circle at 25px 25px, rgba(0,0,0,0.035) 2px, transparent 0)",
                  backgroundSize: "46px 46px",
                }}
              >
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  {conversationMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-md rounded-2xl p-4 text-sm shadow-sm ${
                        message.direction === "inbound"
                          ? "self-start bg-white"
                          : "self-end bg-[#d9fdd3]"
                      }`}
                    >
                      <p className="whitespace-pre-line text-slate-800">
                        {message.message_text || "-"}
                      </p>
                      <p className="mt-2 text-right text-[11px] text-slate-500">
                        {message.created_at
                          ? new Date(message.created_at).toLocaleString("tr-TR")
                          : ""}
                      </p>
                    </div>
                  ))}

                  {conversationMessages.length === 0 && (
                    <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
                      Bu kişiyle henüz kayıtlı konuşma yok.
                    </div>
                  )}

                  {msg && (
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-900 shadow-sm">
                      {msg}
                    </div>
                  )}
                </div>
              </div>

              <footer className="border-t border-slate-300 bg-[#f0f2f5] p-4">
                <div className="mx-auto flex max-w-3xl gap-2 rounded-2xl bg-white p-3 shadow-sm">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendReply();
                    }}
                    placeholder="Cevap yaz..."
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-[#00a884]"
                  />

                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={replying || !replyText.trim()}
                    className="rounded-xl bg-[#00a884] px-5 py-3 font-semibold text-white disabled:opacity-50"
                  >
                    {replying ? "Gönderiliyor..." : "Gönder"}
                  </button>
                </div>
              </footer>
            </>
          ) : !groupId && !selectedContact ? (
            <div
              className="flex flex-1 items-center justify-center p-6 text-center"
              style={{
                backgroundColor: "#efeae2",
                backgroundImage:
                  "radial-gradient(circle at 25px 25px, rgba(0,0,0,0.035) 2px, transparent 0)",
                backgroundSize: "46px 46px",
              }}
            >
              <div className="rounded-3xl bg-white p-8 shadow-sm">
                <div className="text-4xl">💬</div>
                <h2 className="mt-4 text-xl font-semibold">
                  Lütfen soldan bir grup veya kişi seçin
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Seçim yapmadan template veya gönder butonu gösterilmez.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                className="flex-1 overflow-y-auto p-6"
                style={{
                  backgroundColor: "#efeae2",
                  backgroundImage:
                    "radial-gradient(circle at 25px 25px, rgba(0,0,0,0.035) 2px, transparent 0)",
                  backgroundSize: "46px 46px",
                }}
              >
                <div className="mx-auto max-w-3xl space-y-4">
                  <div className="rounded-2xl bg-white p-5 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setTemplateModalOpen(true)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-sm hover:border-[#00a884]"
                    >
                      <div className="text-xs font-medium text-slate-500">
                        Meta Template
                      </div>
                      <div className="mt-1 font-semibold text-slate-900">
                        {selectedTemplate
                          ? `${selectedTemplate.name} — ${selectedTemplate.language}`
                          : "Template seç"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Tıklayınca template önizleme ekranı açılır.
                      </div>
                    </button>

                    {hasImageHeader && (
                      <>
                        <label className="mt-4 block text-xs font-medium text-slate-500">
                          Header Görseli
                        </label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage(file);
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900"
                        />

                        {uploading && (
                          <p className="mt-2 text-sm text-slate-500">
                            Görsel yükleniyor...
                          </p>
                        )}

                        {headerImageUrl && (
                          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                            <span>✅ Görsel yüklendi</span>
                            <button
                              type="button"
                              onClick={() => setHeaderImageUrl("")}
                              className="font-semibold text-emerald-900 underline"
                            >
                              Kaldır
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {variableCount > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="text-xs font-medium text-slate-500">
                          Değişkenler
                        </div>

                        {Array.from({ length: variableCount }).map(
                          (_, index) => (
                            <input
                              key={index}
                              value={bodyVariables[index] || ""}
                              onChange={(e) => {
                                const next = [...bodyVariables];
                                next[index] = e.target.value;
                                setBodyVariables(next);
                              }}
                              placeholder={`{{${index + 1}}} değeri`}
                              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none focus:border-[#00a884]"
                            />
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <div className="relative max-w-md rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm">
                      <p className="whitespace-pre-line text-sm leading-6 text-slate-800">
                        {previewText || selectedTemplate?.name || "Şablon seç"}
                      </p>

                      <p className="mt-2 text-right text-[11px] text-slate-500">
                        {selectedTemplate?.language || ""}
                      </p>
                    </div>
                  </div>

                  {msg && (
                    <div className="rounded-2xl bg-white p-4 text-sm text-slate-900 shadow-sm">
                      {msg}
                    </div>
                  )}
                </div>
              </div>

              <footer className="border-t border-slate-300 bg-[#f0f2f5] p-4">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={
                    sending ||
                    uploading ||
                    (!groupId && !selectedContact) ||
                    !selectedTemplate ||
                    (hasImageHeader && !headerImageUrl)
                  }
                  className="w-full rounded-full bg-[#00a884] px-5 py-3 font-semibold text-white shadow-sm disabled:opacity-50"
                >
                  {sending ? "Kuyruğa alınıyor..." : "Gönder"}
                </button>
              </footer>
            </>
          )}
        </section>
      </div>

      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Template Seç
                </h2>
                <p className="text-sm text-slate-500">
                  Önizlemeyi kontrol edip göndermek istediğin template’i seç.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Kapat
              </button>
            </div>

            <div className="grid max-h-[75vh] grid-cols-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
              {templates.map((t) => {
                const body =
                  t.components?.find((c) => c.type?.toUpperCase() === "BODY")
                    ?.text || "";

                const header = t.components?.find(
                  (c) => c.type?.toUpperCase() === "HEADER",
                );

                const isImageHeader = header?.format?.toUpperCase() === "IMAGE";
                const key = `${t.name}__${t.language}`;
                const isSelected = selectedTemplateKey === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateKey(key);
                      setTemplateModalOpen(false);
                    }}
                    className={`rounded-3xl border p-4 text-left transition ${
                      isSelected
                        ? "border-[#00a884] bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-[#00a884]"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-500">
                          {t.language} — {t.category}
                        </div>
                      </div>

                      {isImageHeader && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Görsel ister
                        </span>
                      )}
                    </div>

                    <div className="rounded-2xl bg-[#efeae2] p-3">
                      <div className="ml-auto max-w-sm rounded-2xl rounded-tr-sm bg-[#d9fdd3] p-4 shadow-sm">
                        {isImageHeader && (
                          <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-slate-200 text-sm text-slate-500">
                            Header görsel alanı
                          </div>
                        )}

                        <p className="whitespace-pre-line text-sm leading-6 text-slate-800">
                          {body || "Body içeriği yok"}
                        </p>

                        <p className="mt-2 text-right text-[11px] text-slate-500">
                          {t.language}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 text-right text-sm font-semibold text-[#00a884]">
                      {isSelected ? "Seçili" : "Bu template’i seç"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Gönderimi Onayla</h2>

            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                <b>Hedef:</b> {selectedTargetName || "-"}
              </p>
              <p>
                <b>Template:</b> {selectedTemplate?.name || "-"}
              </p>
              <p>
                <b>Değişken:</b> {bodyVariables.join(", ") || "-"}
              </p>
              <p>
                <b>Görsel:</b> {headerImageUrl ? "Var" : "Yok"}
              </p>

              {headerImageUrl && (
                <div className="mt-4 overflow-hidden rounded-2xl border bg-slate-50">
                  <img
                    src={headerImageUrl}
                    alt="Gönderilecek görsel"
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-[#d9fdd3] p-4 text-slate-800">
                <p className="whitespace-pre-line text-sm leading-6">
                  {previewText || selectedTemplate?.name || "Şablon seç"}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl bg-slate-200 py-2"
              >
                Vazgeç
              </button>

              <button
                type="button"
                disabled={sending}
                onClick={async () => {
                  setConfirmOpen(false);
                  await send();
                }}
                className="flex-1 rounded-xl bg-[#00a884] py-2 font-semibold text-white disabled:opacity-50"
              >
                {sending ? "Kuyruğa alınıyor..." : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
