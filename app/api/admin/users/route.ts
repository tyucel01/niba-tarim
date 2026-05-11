import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey);

function normalizeEmail(email?: string | null) {
  return (email || "").trim().toLowerCase();
}

function normalizePhone(phone?: string | null) {
  return (phone || "").trim().replace(/\s/g, "");
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

function getAdminPhones() {
  return (process.env.ADMIN_PHONES || "")
    .split(",")
    .map((phone) => normalizePhone(phone))
    .filter(Boolean);
}

async function checkAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return {
      ok: false,
      reason: "Token yok",
      email: "",
      phone: "",
      adminEmails: getAdminEmails(),
      adminPhones: getAdminPhones(),
    };
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      reason: error?.message || "Kullanıcı bulunamadı",
      email: "",
      phone: "",
      adminEmails: getAdminEmails(),
      adminPhones: getAdminPhones(),
    };
  }

  const email = normalizeEmail(data.user.email);
  const phone = normalizePhone(data.user.phone);

  const adminEmails = getAdminEmails();
  const adminPhones = getAdminPhones();

  const noRestriction = adminEmails.length === 0 && adminPhones.length === 0;
  const emailAllowed = email ? adminEmails.includes(email) : false;
  const phoneAllowed = phone ? adminPhones.includes(phone) : false;

  return {
    ok: noRestriction || emailAllowed || phoneAllowed,
    reason: noRestriction
      ? "ADMIN_EMAILS ve ADMIN_PHONES boş olduğu için izin verildi"
      : "Email veya telefon yetkili listesinde değil",
    email,
    phone,
    adminEmails,
    adminPhones,
  };
}

export async function GET(req: NextRequest) {
  const auth = await checkAdmin(req);

  if (!auth.ok) {
    return NextResponse.json(
      {
        error: "Yetkisiz",
        detail: auth,
      },
      { status: 401 }
    );
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data.users || [] });
}