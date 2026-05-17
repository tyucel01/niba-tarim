import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_VERSION = "siparis-import-v2026-05-13-debug-fixed";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeKey(value: any) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function num(value: any) {
  if (value === null || value === undefined || value === "") return "0";
  if (typeof value === "number") return String(value);

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? String(n) : "0";
}

function dateToISO(value: any) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;

    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
      parsed.d
    ).padStart(2, "0")}`;
  }

  const str = String(value).trim();
  const trDate = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);

  if (trDate) {
    const dd = trDate[1].padStart(2, "0");
    const mm = trDate[2].padStart(2, "0");
    let yyyy = trDate[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;

  return d.toISOString().slice(0, 10);
}

function get(row: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = row[normalizeKey(key)];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, version: IMPORT_VERSION, error: "Dosya bulunamadı." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
      raw: true,
      cellDates: true,
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!sheet) {
      return NextResponse.json(
        {
          success: false,
          version: IMPORT_VERSION,
          error: "Excel sayfası bulunamadı.",
        },
        { status: 400 }
      );
    }

    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: true,
      defval: "",
    });

    const headerRow = matrix[0] || [];
    const dataRows = matrix.slice(1);

    const normalizedHeaders = headerRow.map((h) => normalizeKey(h));

    const insertRows = dataRows
      .map((values) => {
        const row: Record<string, any> = {};

        normalizedHeaders.forEach((header, index) => {
          if (header) row[header] = values[index];
        });

        const payload = {
          satisId: clean(get(row, ["Satış ID", "Satis ID", "satisId"])),

          satisTarihi: dateToISO(
            get(row, ["Satış Tarihi", "Satis Tarihi", "satisTarihi"])
          ),

          bayi: clean(get(row, ["Bayi", "Müşteri", "Musteri", "Cari"])),

          tedarikciler: clean(
            get(row, ["Tedarikçiler", "Tedarikciler", "Tedarikçi", "Tedarikci"])
          ),

          siparisAlan: clean(get(row, ["Sipariş Alan", "Siparis Alan"])),

          urun: clean(get(row, ["Ürün", "Urun", "Malzeme"])),

          marka: clean(get(row, ["Marka"])),

          alisFiyati: num(get(row, ["Alış Fiyatı", "Alis Fiyati"])),

          tedarikciyeOdenecekTutar: num(
            get(row, ["Tedarikçiye Ödene Tutar", "Tedarikciye Odene Tutar"])
          ),

          faturaNo: clean(get(row, ["Fatura No"])),

          tedarikciFaturaTutar: num(
            get(row, ["Tedarikçi Fatura Tutar", "Tedarikci Fatura Tutar"])
          ),

          pesinSatisFiyati: num(
            get(row, ["Peşin Satış Fiyatı", "Pesin Satis Fiyati"])
          ),

          siparisTonaj: num(
            get(row, ["Sİpariş", "Sipariş", "Siparis", "Tonaj", "Miktar"])
          ),

          teslimOlanTonaj: num(get(row, ["Teslim Olan Tonaj"])),

          yapilanOdeme: num(get(row, ["Yapılan Ödeme", "Yapilan Odeme"])),

          satisTuru: clean(get(row, ["Satış Türü", "Satis Turu"])),

          vadeTarihi: dateToISO(get(row, ["Vade Tarihi"])),

          vadeFarki: num(get(row, ["Vade Farkı", "Vade Farki"])),

          vadeSuresi: clean(get(row, ["Vade Süresi", "Vade Suresi"])),

          not: clean(get(row, ["Not", "Açıklama", "Aciklama"])),

nakliye: num(get(row, ["Nakliye"])),

          plaka: clean(get(row, ["Plaka"])),

          sevkYeri: clean(get(row, ["Sevk Yeri"])),

          sevkDurumu: clean(get(row, ["Sevk Durumu"])),

          gelenFatura: clean(get(row, ["Gelen Fatura"])),

          sevkNo: clean(get(row, ["Sevk No"])),

          gts: clean(get(row, ["GTS"])),

          fatura: clean(get(row, ["Fatura"])),

          bayiSatisToplam: num(
            get(row, ["Bayiye Satış Tutarı Toplam", "Bayiye Satis Tutari Toplam"])
          ),
        };

        return payload;
      })
      .filter((p) => p.satisId || p.bayi || p.urun || p.siparisTonaj !== "0");

    if (insertRows.length === 0) {
      return NextResponse.json({
        success: false,
        version: IMPORT_VERSION,
        error: "Import edilecek dolu satır bulunamadı.",
        debug: {
          headerRow,
          normalizedHeaders,
          firstDataRow: dataRows[0] || null,
        },
      });
    }

    const { error } = await supabase.from("siparisler").insert(insertRows);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          version: IMPORT_VERSION,
          error: error.message,
          samplePayload: insertRows[0],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      version: IMPORT_VERSION,
      totalRows: dataRows.length,
      inserted: insertRows.length,
      samplePayload: insertRows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        version: IMPORT_VERSION,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}