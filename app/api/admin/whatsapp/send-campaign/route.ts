import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const {
      groupId,
      contactId,
      templateName,
      languageCode,
      headerImageUrl,
      bodyVariables,
    } = await req.json();

    if (!templateName) {
      return NextResponse.json({
        success: false,
        error: "Şablon zorunlu.",
      });
    }

    if (!groupId && !contactId) {
      return NextResponse.json({
        success: false,
        error: "Grup veya kişi seçilmedi.",
      });
    }

    let list: {
      contact_id: string | null;
      name: string;
      phone: string;
    }[] = [];

    if (groupId) {
      const { data: members, error: membersError } = await supabase
        .from("whatsapp_group_members")
        .select(`
          whatsapp_contacts (
            id,
            name,
            phone
          )
        `)
        .eq("group_id", groupId);

      if (membersError) {
        return NextResponse.json({
          success: false,
          error: membersError.message,
        });
      }

      list =
        members
          ?.map((m: any) => ({
            contact_id: m.whatsapp_contacts?.id || null,
            name: m.whatsapp_contacts?.name || "",
            phone: String(m.whatsapp_contacts?.phone || "").replace(/\D/g, ""),
          }))
          .filter((m) => m.phone) || [];
    }

    if (contactId) {
      const { data: contact, error: contactError } = await supabase
        .from("whatsapp_contacts")
        .select("id, name, phone")
        .eq("id", contactId)
        .single();

      if (contactError || !contact) {
        return NextResponse.json({
          success: false,
          error: contactError?.message || "Kişi bulunamadı.",
        });
      }

      const cleanPhone = String(contact.phone || "").replace(/\D/g, "");

      if (!cleanPhone) {
        return NextResponse.json({
          success: false,
          error: "Bu kişide geçerli telefon yok.",
        });
      }

      list = [
        {
          contact_id: contact.id,
          name: contact.name || "",
          phone: cleanPhone,
        },
      ];
    }

    if (list.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Gönderilecek geçerli telefon yok.",
      });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("whatsapp_campaigns")
      .insert([
        {
          name: contactId
            ? `${templateName} bireysel gönderim`
            : `${templateName} grup gönderimi`,
          group_id: groupId || null,
          template_name: templateName,
          language_code: languageCode || "tr",
          header_image_url: headerImageUrl || null,
          body_variables: bodyVariables || [],
          status: "pending",
          total_count: list.length,
          success_count: 0,
          fail_count: 0,
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

    const queueRows = list.map((person) => ({
      campaign_id: campaign.id,
      contact_id: person.contact_id,
      phone: person.phone,
      name: person.name,
      status: "pending",
      attempt_count: 0,
    }));

    const { error: queueError } = await supabase
      .from("whatsapp_message_queue")
      .insert(queueRows);

    if (queueError) {
      return NextResponse.json({
        success: false,
        error: queueError.message,
      });
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      queued: queueRows.length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}