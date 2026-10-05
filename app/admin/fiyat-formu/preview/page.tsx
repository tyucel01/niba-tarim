"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Share2, FileText, List, CheckCircle2 } from "lucide-react";
import { PRICE_HANDOFF_KEY } from "@/lib/whatsapp/price-handoff";
import styles from "./preview.module.css";

type Row = { urun: string; depo: string; teslim: string; pesin: string; kredi: string };

function PreviewContent() {
  const params = useSearchParams();
  const raw = params.get("rows");
  const rows = useMemo<Row[]>(() => {
    try {
      const value: unknown = JSON.parse(raw || "[]");
      if (!Array.isArray(value)) return [];
      return value.filter((r): r is Row => r !== null && typeof r === "object" &&
        ["urun", "depo", "teslim", "pesin", "kredi"].every(key => typeof r[key] === "string"))
        .filter(r => r.urun || r.depo || r.teslim || r.pesin || r.kredi);
    } catch { return []; }
  }, [raw]);
  const ref = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: 1, height: 900 });
  const [view, setView] = useState<"list" | "document">("list");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const [transferring, setTransferring] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const today = new Date().toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" });

  useEffect(() => {
    const node = container.current, documentNode = ref.current;
    if (!node || !documentNode) return;
    const resize = () => setSize({ scale: Math.min(node.clientWidth / 1200, 1), height: documentNode.offsetHeight });
    const observer = new ResizeObserver(resize);
    observer.observe(node); observer.observe(documentNode); resize();
    return () => observer.disconnect();
  }, [rows]);

  useEffect(() => {
    if (!rows.length) return;
    let cancelled = false;
    async function prepare() {
      setFile(null); setError("");
      try {
        await document.fonts.ready;
        const node = ref.current;
        if (!node) return;
        await Promise.all(Array.from(node.querySelectorAll("img")).map(img => img.decode()));
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(node, {
          scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0,
          windowWidth: 1440,
          onclone: cloned => {
            const target = cloned.getElementById("price-document");
            if (target?.parentElement) {
              target.parentElement.style.transform = "none";
              target.parentElement.style.position = "static";
              target.parentElement.style.width = "1200px";
            }
          },
        });
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error()), "image/jpeg", 0.95));
        if (cancelled) return;
        const image = new File([blob], `niba-fiyat-${today.replaceAll(".", "-")}.jpg`, { type: "image/jpeg" });
        setFile(image); setCanShare(Boolean(navigator.canShare?.({ files: [image] })));
      } catch { if (!cancelled) setError("Görsel hazırlanamadı. Lütfen yeniden deneyin."); }
    }
    void prepare();
    return () => { cancelled = true; };
  }, [rows, today, retry]);

  function downloadImage() {
    if (!file) return;
    const url = URL.createObjectURL(file), link = document.createElement("a");
    link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice("Görsel indirilmeye hazır. Telefonunda açılırsa paylaş menüsünden kaydedebilirsin.");
  }
  async function openWhatsApp() {
    if (!file || transferring) return;
    setTransferring(true); setNotice("");
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("Görsel aktarım için çok büyük. Ürünleri iki listeye ayırıp tekrar deneyin.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Görsel okunamadı.")); reader.readAsDataURL(file);
      });
      try { sessionStorage.setItem(PRICE_HANDOFF_KEY, JSON.stringify({ dataUrl, name: file.name, createdAt: Date.now() })); }
      catch { throw new Error("Tarayıcı görseli saklayamadı. Görseli indirip gönderim ekranında yükleyebilirsin."); }
      window.location.assign("/admin/whatsapp/gonder?source=fiyat-formu");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "WhatsApp gönderimine geçilemedi. Lütfen tekrar deneyin.");
      setTransferring(false);
    }
  }
  async function shareImage() {
    if (!file) return;
    try { await navigator.share({ files: [file], title: "Niba Tarım fiyat listesi" }); }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setNotice("Paylaşım açılamadı. Görseli indirip istediğin uygulamadan gönderebilirsin."); }
  }
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <Link href="/admin/fiyat-formu" className={styles.back}><ArrowLeft size={18} /> Forma dön ve düzenle</Link>
        <header className={styles.header}>
          <div><span className={styles.eyebrow}>NİBA TARIM · FİYAT LİSTESİ</span><h1>Kontrol et, indir, paylaş.</h1><p>{today} · {rows.length} ürün</p></div>
          {!!rows.length && <span className={styles.badge}><CheckCircle2 size={16} /> Önizleme</span>}
        </header>
        {!rows.length ? <div className={styles.empty}><h2>Önizlenecek ürün bulunamadı</h2><p>Forma dönüp en az bir ürün satırı doldur.</p><Link href="/admin/fiyat-formu">Fiyat formuna dön →</Link></div> : <>
          <div className={styles.tabs} role="group" aria-label="Önizleme görünümü">
            <button aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18} /> Ürünleri kontrol et</button>
            <button aria-pressed={view === "document"} onClick={() => setView("document")}><FileText size={18} /> Belgeyi gör</button>
          </div>
          {view === "list" && <section className={styles.cards} aria-label="Fiyat listesi ürünleri">{rows.map((row, i) => <article className={styles.card} key={i}>
            <div className={styles.cardHeading}><span>{String(i + 1).padStart(2, "0")}</span><h2>{row.urun || "Ürün belirtilmedi"}</h2></div>
            <dl className={styles.details}><div><dt>Depo / sevk yeri</dt><dd>{row.depo || "—"}</dd></div><div><dt>Teslim şekli</dt><dd>{row.teslim || "—"}</dd></div></dl>
            <dl className={styles.prices}><div><dt>Peşin / ton</dt><dd>{row.pesin || "—"}</dd></div><div><dt>Kredi kartı / ton</dt><dd>{row.kredi || "—"}</dd></div></dl>
          </article>)}</section>}
          <section aria-label="İndirilecek belge" aria-hidden={view !== "document"} className={view === "document" ? styles.documentSection : styles.offscreen}>
            <p className={styles.hint}>İndirilen görselin tamamı · Yüksek çözünürlüklü JPG</p>
            <div ref={container} className={styles.paperFrame} style={{ height: size.height * size.scale }}>
              <div style={{ width: 1200, transform: `scale(${size.scale})`, transformOrigin: "top left" }}>
      {/* SNAPSHOT ALINAN ALAN */}
      <div
        ref={ref}
        id="price-document"
        style={{
          width: 1200,
          margin: 0,
          background: "#fff",
          padding: 40,
          fontFamily: "Arial, sans-serif",
          color: "#000",
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          
          {/* LOGO */}
          <img
            src="/niba-logo-horizontal.png"
            alt="Niba Tarım"
            style={{
              height: 175,        // 👈 buradan büyüt
              marginLeft: -82,      // 👈 buradan hizala
            }}
          />

          {/* TARİH */}
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              marginTop: 60,
            }}
          >
            {today}
          </div>
        </div>

        {/* TEXT */}
        <div style={{ marginTop: 20, fontSize: 22, lineHeight: 1.5 }}>
          <p>Değerli Bayimiz,</p>

          <p style={{ marginTop: 20 }}>
            Bugün için geçerli satış fiyatlarımız aşağıdaki gibidir. Bizimle{" "}
            <b>0533 492 8522</b> veya <b>0530 454 6422</b> numaralı telefonlardan
            iletişime geçebilirsiniz.
          </p>
        </div>

        {/* TABLE */}
        <table
          style={{
            width: "100%",
            marginTop: 20,
            borderCollapse: "collapse",
            fontSize: 20,
          }}
        >
          <thead>
            <tr>
              {[
                "Gübre Cinsi",
                "Depo Sevk Yeri",
                "Teslim Şekli",
                "Peşin (TON)",
                "Kredi Kartı (TON)",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    border: "1px solid black",
                    padding: 8,
                    textAlign: "left",
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={tdBold}>{row.urun}</td>
                <td style={td}>{row.depo}</td>
                <td style={td}>{row.teslim}</td>
                <td style={tdRight}>{row.pesin}</td>
                <td style={tdRight}>{row.kredi}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* FOOTER */}
        <div style={{ marginTop: 30, fontSize: 20, lineHeight: 1.5 }}>
          <p>
            1- Ödeme gününde ödemesi tamamlanmayan siparişlerin iptal hakkı Niba
            Tarım&apos;ın inisiyatifindedir.
          </p>
          <p>
            2- 7 gün içerisinde sevk edilmeyen siparişlerin, piyasa koşulları ve
            tedarik riskine göre iptal hakkı Niba Tarım&apos;ın inisiyatifindedir.
          </p>
          <p>3- Fiyatlar stok durumuna göre değişiklik gösterebilir.</p>
        </div>
      </div>

              </div>
            </div>
          </section>
          <div className={styles.feedback} aria-live="polite">{error || notice || (!file ? "Görsel hazırlanıyor…" : "Paylaşmaya hazır. Fiyat listesi görsel olarak kaydedilir.")}
            {error && <button onClick={() => setRetry(r => r + 1)}>Yeniden dene</button>}
          </div>
          <footer className={styles.actions}>
            <button disabled={!file || transferring} onClick={() => void openWhatsApp()} className={`${styles.primary} ${styles.whatsapp}`}>{transferring ? "Görsel aktarılıyor…" : "WhatsApp gönderimine geç"}</button>
            <button disabled={!file} onClick={downloadImage} className={styles.primary}><Download size={19} />{file ? "Görseli indir" : "Hazırlanıyor…"}</button>
            {canShare && <button disabled={!file} onClick={() => void shareImage()} className={styles.secondary}><Share2 size={19} /> Paylaş</button>}
          </footer>
        </>}
      </div>
    </main>
  );
}
const td = { border: "1px solid black", padding: 8, overflowWrap: "anywhere" as const };
const tdBold = { ...td, fontWeight: 700 };
const tdRight = { ...td, textAlign: "right" as const };
export default function Page() {
  return <Suspense fallback={<main className={styles.page}>Önizleme yükleniyor…</main>}><PreviewContent /></Suspense>;
}
