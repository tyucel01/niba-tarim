import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { groupId, templateName, languageCode } = await req.json();

  if (!groupId || !templateName) {
    return NextResponse.json({
      success: false,
      error: "Grup ve şablon zorunlu.",
    });
  }

  const { data: members, error: membersError } = await supabase
    .from("whatsapp_group_members")
    .select(`
      contact_id,
      whatsapp_contacts (
        id,
        name,
        phone
      )
    `)
    .eq("group_id", groupId);

  if (membersError) {
    return NextResponse.json({ success: false, error: membersError.message });
  }

  const validMembers =
    members
      ?.map((m: any) => ({
        contact_id: m.whatsapp_contacts?.id,
        name: m.whatsapp_contacts?.name || "",
        phone: String(m.whatsapp_contacts?.phone || "").replace(/\D/g, ""),
      }))
      .filter((m) => m.phone) || [];

  if (validMembers.length === 0) {
    return NextResponse.json({
      success: false,
      error: "Bu grupta gönderilecek geçerli telefon yok.",
    });
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("whatsapp_campaigns")
    .insert([
      {
        name: `${templateName} gönderimi`,
        group_id: groupId,
        template_name: templateName,
        language_code: languageCode || "tr",
        status: "pending",
        total_count: validMembers.length,
      },
    ])
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({
      success: false,
      error: campaignError?.message || "Kampanya oluşturulamadı.",
    });
  }

  const queueRows = validMembers.map((member) => ({
    campaign_id: campaign.id,
    contact_id: member.contact_id,
    name: member.name,
    phone: member.phone,
    status: "pending",
  }));

  const { error: queueError } = await supabase
    .from("whatsapp_message_queue")
    .insert(queueRows);

  if (queueError) {
    return NextResponse.json({ success: false, error: queueError.message });
  }

  return NextResponse.json({
    success: true,
    campaign,
    queued: queueRows.length,
  });
}