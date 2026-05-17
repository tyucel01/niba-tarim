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
  const [page, setPage] = useState(1);

  const pageSize = 25;

  async function loadSiparisler() {
    try {
      setLoading(true);
      setMessage("");

      const res = await fetch(`/api/admin/siparisler?t=${Date.now()}`, {
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

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

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

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const totalPages = Math.max(Math.ceil(filtered.length / pageSize), 1);
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
                Supabase Sipariş Verisi
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                Siparişler
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Göz ikonuna tıklayarak sipariş detayına gidebilir, operasyon bilgilerini oradan yönetebilirsin.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/siparisler/import"
                prefetch={false}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/15"
              >
                Excel Import
              </Link>

              <button
                type="button"
                onClick={loadSiparisler}
                disabled={loading}
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white ring-1 ring-white/15 disabled:opacity-50"
              >
                {loading ? "Yükleniyor..." : "Yenile"}
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = "/admin/siparisler/yeni-siparis";
                }}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Yeni Sipariş
              </button>
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sipariş no, bayi, ürün, plaka ara..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold outline-none focus:border-[#00a884] focus:ring-4 focus:ring-emerald-100 xl:max-w-lg"
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

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
            <div className="min-w-[1660px] space-y-2 p-2">
              <div className="grid grid-cols-[70px_120px_170px_190px_170px_120px_100px_130px_140px_100px_100px_140px_120px] gap-3 px-4 text-[11px] font-black uppercase tracking-wide text-slate-400">
                <div>Gör</div>
                <div>Sipariş</div>
                <div>Bayi</div>
                <div>Tedarikçi</div>
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
                paginated.map((s, index) => {
                  const status = getInvoiceStatus(s);
                  const alreadyInvoiced =
                    Boolean(s.sales_invoice_id) || Boolean(s.sales_invoice_no);
                  const globalIndex = (page - 1) * pageSize + index;
                  const siparisNo = s.satisId || s.id || globalIndex + 1;
                  const detailId = s.id || siparisNo;

                  return (
                    <div
                      key={s.id || siparisNo || globalIndex}
                      className="grid grid-cols-[70px_120px_170px_190px_170px_120px_100px_130px_140px_100px_100px_140px_120px] items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 transition hover:bg-emerald-50/60"
                    >
                      <div>
                        <Link
                          href={`/admin/siparisler/${encodeURIComponent(String(detailId))}`}
                          prefetch={false}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-slate-200 hover:bg-emerald-50"
                          title="Sipariş Detayı"
                        >
                          👁
                        </Link>
                      </div>

                      <div>
                        <p className="text-sm font-black text-slate-950">
                          #{siparisNo}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {formatDate(s.satisTarihi)}
                        </p>
                      </div>

                      <div>
                        <p className="truncate text-sm font-black text-slate-800">
                          {s.bayi || "-"}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {s.siparisAlan || ""}
                        </p>
                      </div>

                      <div>
                        <p className="truncate text-sm font-black text-slate-800">
                          {s.tedarikciler || "-"}
                        </p>
                      </div>

                      <div>
                        <p className="truncate text-sm font-black text-slate-950">
                          {s.urun || "-"}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {s.marka || ""}
                        </p>
                      </div>

                      <div className="text-sm font-black text-slate-700">
                        {s.plaka || "-"}
                      </div>

                      <div className="text-sm font-black text-slate-950">
                        {formatNumber(numberValue(s.siparisTonaj))} ton
                      </div>

                      <div className="text-sm font-bold text-slate-700">
                        {formatMoney(numberValue(s.pesinSatisFiyati))}
                      </div>

                      <div className="text-sm font-black text-emerald-700">
                        {formatMoney(numberValue(s.bayiSatisToplam))}
                      </div>

                      <Badge ok={status.sevkOk} text={status.sevkOk ? "Tamam" : "Eksik"} />
                      <Badge ok={status.gtsOk} text={status.gtsOk ? "Girildi" : "Eksik"} />
                      <Badge ok={status.alisOk} text={status.alisOk ? "Eşleşti" : "Yok"} />

                      <div>
                        {alreadyInvoiced ? (
                          <div className="rounded-xl bg-emerald-100 px-4 py-2 text-center text-xs font-black text-emerald-700 ring-1 ring-emerald-200">
                            Fatura Kesildi
                          </div>
                        ) : status.canInvoice ? (
                          <Link
                            href={`/admin/siparisler/fatura-kes?siparisId=${encodeURIComponent(
                              String(s.id || siparisNo)
                            )}`}
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

          {!loading && filtered.length > 0 && (
            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs font-bold text-slate-500">
                Sayfa {page} / {totalPages}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-40"
                >
                  Önceki
                </button>

                {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                  const pageNo = i + 1;
                  return (
                    <button
                      key={pageNo}
                      type="button"
                      onClick={() => setPage(pageNo)}
                      className={`rounded-xl px-4 py-2 text-xs font-black ${
                        page === pageNo
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {pageNo}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function getInvoiceStatus(s: any) {
  const sevkDurumu = String(s.sevkDurumu || "").toLowerCase();
  const gts = String(s.gts || "").toLowerCase();
  const alis = String(s.gelenFatura || s.matched_purchase_invoice_no || "").toLowerCase();

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

function formatDate(value: any) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("tr-TR");
}
