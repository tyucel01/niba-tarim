import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(req: Request, context: Context) {
  const { id } = await context.params;

  await supabase.from("whatsapp_group_members").delete().eq("group_id", id);

  const { error } = await supabase.from("whatsapp_groups").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message });
  }

  return NextResponse.json({ success: true });
}