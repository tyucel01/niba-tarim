"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Filter = "all" | "ready" | "blocked";

export default function SiparislerPage() {
  const [loading, setLoading] = useState(true);
  const [siparisler, setSiparisler] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState("");

  async function loadSiparisler() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`/api/admin/google-sheets/siparisler?t=${Date.now()}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!data.success) {
        setMessage("❌ Siparişler alınamadı: " + JSON.stringify(data.error));
        setSiparisler([]);
        return;
      }

      setSiparisler(data.rows || []);
    } catch (err) {
      setMessage("❌ Hata: " + String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSiparisler();
  }, []);

  const filtered = useMemo(() => {
    return siparisler.filter((s) => {
      const text = JSON.stringify(s).toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      const status = getInvoiceStatus(s);

      if (filter === "ready") return matchSearch && status.canInvoice;
      if (filter === "blocked") return matchSearch && !status.canInvoice;

      return matchSearch;
    });
  }, [siparisler, search, filter]);

  const readyCount = siparisler.filter((s) => getInvoiceStatus(s).canInvoice).length;
  const blockedCount = siparisler.length - readyCount;

  return (
    <main className="min-h-screen bg-[#eef1ea] p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href="/admin" prefetch={false} className="font-black text-emerald-800">
          ← Admin Panel
        </Link>

        <section className="rounded-[32px] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-900/10">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
                Google Sheet Bağlantısı
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Siparişler
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Siparişler Google Sheet üzerinden canlı okunur.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={loadSiparisler}
                disabled={loading}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/15 disabled:opacity-50"
              >
                {loading ? "Yükleniyor..." : "Yenile"}
              </button>

              <Link
                href="/admin/siparisler/form"
                prefetch={false}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Yeni Sipariş
              </Link>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Toplam Sipariş" value={siparisler.length} />
            <MiniStat label="Fatura Kesilebilir" value={readyCount} />
            <MiniStat label="Eksik Kontrol" value={blockedCount} />
            <MiniStat label="Listelenen" value={filtered.length} />
          </div>

          {message && (
            <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm font-bold ring-1 ring-white/15">
              {message}
            </div>
          )}
        </section>

        <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sipariş no, bayi, ürün, plaka ara..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100 md:max-w-md"
            />

            <div className="flex flex-wrap gap-2">
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                Tümü
              </FilterButton>
              <FilterButton active={filter === "ready"} onClick={() => setFilter("ready")}>
                Fatura Kesilebilir
              </FilterButton>
              <FilterButton active={filter === "blocked"} onClick={() => setFilter("blocked")}>
                Eksik Kontrol
              </FilterButton>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[1200px] space-y-2">
              <div className="grid grid-cols-[120px_1.2fr_1.1fr_100px_90px_120px_130px_120px_100px_150px_130px] gap-3 px-4 text-[11px] font-black uppercase tracking-wide text-slate-400">
                <div>Sipariş</div>
                <div>Bayi</div>
                <div>Ürün</div>
                <div>Plaka</div>
                <div>Tonaj</div>
                <div>Birim Fiyat</div>
                <div>Toplam</div>
                <div>Sevk</div>
                <div>GTS</div>
                <div>Alış Faturası</div>
                <div>İşlem</div>
              </div>

              {loading ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-sm font-bold text-slate-500">
                  Siparişler yükleniyor...
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center">
                  <div className="text-4xl">📦</div>
                  <h2 className="mt-3 text-xl font-black text-slate-950">
                    Sipariş bulunamadı
                  </h2>
                </div>
              ) : (
                filtered.map((s, index) => {
                  const status = getInvoiceStatus(s);
const tonaj = numberValue(
  getField(s, ["siparis", "teslim_olan_tonaj", "tonaj", "miktar"]),
);                  const birimFiyat = numberValue(
getField(s, [
  "bayiye_satis_tutari_toplam",
  "bayi_satis_toplam",
  "toplam_tutar",
  "toplam",
  "tutar",
])
                  );
                  const toplam =
                    numberValue(
                      getField(s, [
                        "bayi_satis_toplam",
                        "toplam_tutar",
                        "toplam",
                        "tutar",
                      ]),
                    ) || tonaj * birimFiyat;

                  return (
                    <div
                      key={getField(s, ["id", "satis_id", "siparis_no"]) || index}
                      className="grid grid-cols-[120px_1.2fr_1.1fr_100px_90px_120px_130px_120px_100px_150px_130px] items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-950">
                          #{getField(s, ["satis_id", "siparis_no", "id"]) || index + 1}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {getField(s, ["satis_tarihi", "tarih"]) || "-"}
                        </p>
                      </div>

                      <div className="truncate text-sm font-bold text-slate-800">
                        {getField(s, ["bayi", "musteri", "bayi_adi"]) || "-"}
                      </div>

                      <div>
                        <p className="truncate text-sm font-black text-slate-950">
                          {getField(s, ["urun", "urun_adi", "malzeme"]) || "-"}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {getField(s, ["marka"]) || ""}
                        </p>
                      </div>

                      <div className="text-sm font-black text-slate-700">
                        {getField(s, ["plaka"]) || "-"}
                      </div>

                      <div className="text-sm font-black text-slate-950">
                        {formatNumber(tonaj)} ton
                      </div>

                      <div className="text-sm font-bold text-slate-700">
                        {formatMoney(birimFiyat)}
                      </div>

                      <div className="text-sm font-black text-emerald-700">
                        {formatMoney(toplam)}
                      </div>

                      <Badge ok={status.sevkOk} text={status.sevkOk ? "Tamam" : "Eksik"} />
                      <Badge ok={status.gtsOk} text={status.gtsOk ? "Girildi" : "Eksik"} />
                      <Badge ok={status.alisOk} text={status.alisOk ? "Eşleşti" : "Yok"} />

                      <div>
                        {status.canInvoice ? (
                          <Link
                            href={`/admin/siparisler/fatura-kes?siparisId=${
                              getField(s, ["id", "satis_id", "siparis_no"]) || index
                            }`}
                            prefetch={false}
                            className="inline-flex rounded-xl bg-gradient-to-r from-[#00a884] to-[#00c297] px-4 py-2 text-xs font-black text-white shadow-lg shadow-emerald-900/10"
                          >
                            Fatura Kes
                          </Link>
                        ) : (
                          <div>
                            <button
                              type="button"
                              disabled
                              className="rounded-xl bg-slate-200 px-4 py-2 text-xs font-black text-slate-400"
                            >
                              Kilitli
                            </button>

                            <p className="mt-1 text-[10px] font-bold leading-4 text-red-500">
                              {status.missing.join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function getInvoiceStatus(s: any) {
  const sevkDurumu = String(
    getField(s, ["sevk_durumu", "sevkdumu", "sevk", "sevk_yapildi_mi"]) || "",
  ).toLowerCase();

  const gts = String(
    getField(s, ["gts", "gts_cikisi", "gts_cikisi_yapildi_mi"]) || "",
  ).toLowerCase();

  const alis = String(
    getField(s, [
      "alis_faturasi",
      "alis_faturasi_geldi_mi",
      "gelen_fatura",
      "matched_purchase_invoice_id",
      "matched_purchase_invoice_no",
    ]) || "",
  ).toLowerCase();

  const sevkOk =
    sevkDurumu.includes("evet") ||
    sevkDurumu.includes("sevk edildi") ||
    sevkDurumu.includes("tamam") ||
    sevkDurumu.includes("yapildi") ||
    sevkDurumu.includes("yapıldı");

  const gtsOk =
    gts.includes("evet") ||
    gts.includes("girildi") ||
    gts.includes("cikis") ||
    gts.includes("çıkış") ||
    gts.includes("yapildi") ||
    gts.includes("yapıldı");

  const alisOk =
    Boolean(alis) &&
    !["hayir", "hayır", "yok", "false", "0", "bekliyor"].includes(alis);

  const missing: string[] = [];

  if (!sevkOk) missing.push("Sevk yok");
  if (!gtsOk) missing.push("GTS yok");
  if (!alisOk) missing.push("Alış faturası yok");

  return {
    sevkOk,
    gtsOk,
    alisOk,
    canInvoice: sevkOk && gtsOk && alisOk,
    missing,
  };
}

function getField(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ring-1 ${
        ok
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : "bg-red-50 text-red-700 ring-red-100"
      }`}
    >
      {text}
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-xs font-black ring-1 ${
        active
          ? "bg-slate-950 text-white ring-slate-950"
          : "bg-slate-50 text-slate-600 ring-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className="text-xs font-bold text-white/55">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function numberValue(value: any) {
  if (typeof value === "number") return value;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value || 0);
}