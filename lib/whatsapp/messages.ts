export type MediaAttachment = {
  type: "image" | "sticker" | "document" | "audio" | "video";
  id: string;
  mimeType: string;
  filename: string;
  caption: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  direction: string;
  message_type: string;
  message_text: string | null;
  created_at: string;
  attachment: MediaAttachment | null;
  reaction: string | null;
};

export type ReadVersion = { last_message_at: string; unread_count: number };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }

export function getAttachment(type: string, payload: unknown): MediaAttachment | null {
  if (!["image", "sticker", "document", "audio", "video"].includes(type)) return null;
  const media = record(record(payload)[type]);
  const id = text(media.id);
  if (!/^\d+$/.test(id)) return null;
  return {
    type: type as MediaAttachment["type"], id,
    mimeType: text(media.mime_type), filename: text(media.filename), caption: text(media.caption),
  };
}

export function toChatMessage(row: Record<string, unknown>): ChatMessage {
  const type = text(row.message_type);
  return {
    id: text(row.id), conversation_id: text(row.conversation_id), direction: text(row.direction),
    message_type: type, message_text: text(row.message_text), created_at: text(row.created_at),
    attachment: getAttachment(type, row.raw_payload),
    reaction: type === "reaction" ? text(record(record(row.raw_payload).reaction).emoji) : null,
  };
}

// The webhook updates the conversation before inserting its message. Do not
// acknowledge that version until the corresponding message is actually loaded.
export function readableVersion(version: ReadVersion, messages: ChatMessage[]): ReadVersion | null {
  const latestInbound = [...messages].reverse().find((message) => message.direction === "inbound");
  if (!latestInbound || version.unread_count <= 0) return null;
  const utc = (value: string) => Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
  return utc(latestInbound.created_at) >= utc(version.last_message_at) ? version : null;
}
