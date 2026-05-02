import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { groupId, contacts } = await req.json();

  if (!groupId) {
    return NextResponse.json({ success: false, error: "groupId yok" });
  }

  if (!contacts || !Array.isArray(contacts)) {
    return NextResponse.json({ success: false, error: "contacts listesi yok" });
  }

  let created = 0;
  let addedToGroup = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of contacts) {
    try {
      const name = item.name || "";
      const phone = String(item.phone || "").replace(/\D/g, "");
      const note = item.note || "";

      if (!phone) {
        skipped++;
        continue;
      }

      let contactId: string | null = null;

      const { data: existingContact } = await supabase
        .from("whatsapp_contacts")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact, error: createError } = await supabase
          .from("whatsapp_contacts")
          .insert([{ name, phone, note }])
          .select("id")
          .single();

        if (createError || !newContact) {
          failed++;
          continue;
        }

        contactId = newContact.id;
        created++;
      }

      const { data: existingMember } = await supabase
        .from("whatsapp_group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("contact_id", contactId)
        .maybeSingle();

      if (existingMember) {
        skipped++;
        continue;
      }

      const { error: memberError } = await supabase
        .from("whatsapp_group_members")
        .insert([{ group_id: groupId, contact_id: contactId }]);

      if (memberError) {
        failed++;
      } else {
        addedToGroup++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    success: true,
    summary: {
      total: contacts.length,
      created,
      addedToGroup,
      skipped,
      failed,
    },
  });
}