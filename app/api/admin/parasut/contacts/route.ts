import { cachedIncomingPage } from "@/lib/parasut/incoming-cache";
import { invoiceAdmin } from "@/lib/parasut/invoice-pool";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_URL = "https://api.parasut.com";


async function getParasutToken() {
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "password",
      client_id: process.env.PARASUT_CLIENT_ID,
      client_secret: process.env.PARASUT_CLIENT_SECRET,
      username: process.env.PARASUT_USERNAME,
      password: process.env.PARASUT_PASSWORD,
      redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 429) throw new Error("Paraşüt cari kart servisi geçici olarak yoğun. 1 dakika sonra yeniden deneyin.");
    throw new Error(
      data?.error_description || data?.error || "Paraşüt token alınamadı"
    );
  }

  return data.access_token as string;
}

function mapContact(item: any) {
  const attr = item?.attributes || {};

  return {
    id: item.id,
    name: attr.name || "İsimsiz Cari",
    display_name: attr.name || "İsimsiz Cari",
    email: attr.email || "",
    phone: attr.phone || "",
    taxNumber: attr.tax_number || "",
    tax_number: attr.tax_number || "",
    tax_no: attr.tax_number || "",
    vkn: attr.tax_number || "",
    tckn: attr.tax_number || "",
    city: attr.city || "",
    district: attr.district || "",
    address: attr.address || "",
    attributes: attr,
    raw: item,
  };
}

export async function GET(req: Request) {
  const companyId = process.env.PARASUT_COMPANY_ID;
  if (!companyId) return NextResponse.json({success:false,error:"PARASUT_COMPANY_ID eksik"},{status:500});
  const key = `contacts:${companyId}`;
  const respond = (contacts: any[], stale = false) => NextResponse.json({success:true,ok:true,contacts,items:contacts,data:contacts,count:contacts.length,cached:true,stale,...(stale ? {warning:"Paraşüt geçici olarak yoğun. Kayıtlı cari kartlar gösteriliyor."} : {})});
  try {
    const contacts = await cachedIncomingPage(key, async () => {
      const token = await getParasutToken();
      const allContacts: any[] = [];
      for (let page=1;page<=100;page++) {
        const response = await fetch(`${BASE_URL}/v4/${companyId}/contacts?page[number]=${page}&page[size]=25`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},cache:"no-store"});
        const json = await response.json().catch(()=>null);
        if (!response.ok) throw new Error(response.status===429 ? "Paraşüt cari kart servisi geçici olarak yoğun. 1 dakika sonra yeniden deneyin." : "Paraşüt cari kartları alınamadı. 1 dakika sonra yeniden deneyin.");
        if (!Array.isArray(json?.data)) throw new Error("Paraşüt cari kart yanıtı doğrulanamadı.");
        allContacts.push(...json.data.map(mapContact));
        if (!json.links?.next && (json.data.length<25 || page>=Number(json.meta?.total_pages))) return allContacts;
        if (json.data.length<25) return allContacts;
        await new Promise(resolve=>setTimeout(resolve,350));
      }
      throw new Error("Cari kart listesinin tamamı alınamadı. Yeniden deneyin.");
    },new URL(req.url).searchParams.get("refresh")==="1");
    return respond(contacts);
  } catch (error: any) {
    const {data} = await invoiceAdmin().from("parasut_response_cache").select("payload").eq("cache_key",key).maybeSingle();
    if (Array.isArray(data?.payload)) return respond(data.payload,true);
    return NextResponse.json({success:false,ok:false,error:String(error?.message || "Cari kartlar alınamadı.").replaceAll("Fatura", "Cari kart").replaceAll("fatura", "cari kart")},{status:503});
  }
}
