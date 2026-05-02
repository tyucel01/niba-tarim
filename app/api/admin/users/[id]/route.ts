import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminEmails = (process.env.ADMIN_EMAILS || "").split(",");

const admin = createClient(supabaseUrl, serviceRoleKey);

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;

  const { data } = await admin.auth.getUser(token);
  const email = data.user?.email || "";

  return adminEmails.includes(email);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await checkAdmin(req);
  if (!ok) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updateData: {
    phone?: string;
    password?: string;
    user_metadata?: Record<string, string>;
  } = {};

  if (body.phone) updateData.phone = body.phone;
  if (body.password) updateData.password = body.password;
  if (body.name) updateData.user_metadata = { name: body.name };

  const { data, error } = await admin.auth.admin.updateUserById(id, updateData);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ user: data.user });
}