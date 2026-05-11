"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";

type Row = {
  urun: string;
  depo: string;
  teslim: string;
  pesin: string;
  kredi: string;
};

function PreviewContent() {
  const params = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);

  const rows: Row[] = JSON.parse(params.get("rows") || "[]").filter(
    (r: Row) => r.urun || r.depo || r.teslim || r.pesin || r.kredi
  );

  const today = new Date().toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
  });

  async function downloadImage() {
    if (!ref.current) return;

    const canvas = await html2canvas(ref.current, {
      scale: 2, // 👈 kalite
      useCORS: true,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
    });

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.download = `niba-fiyat-${today}.jpg`;
    link.click();
  }

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mb-4 flex justify-end">
        <button
          onClick={downloadImage}
          className="rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white"
        >
          Fiyatları İndir
        </button>
      </div>

      {/* SNAPSHOT ALINAN ALAN */}
      <div
        ref={ref}
        style={{
          width: 1200,
          margin: "0 auto",
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
            Tarım'ın inisiyatifindedir.
          </p>
          <p>
            2- 7 gün içerisinde sevk edilmeyen siparişlerin, piyasa koşulları ve
            tedarik riskine göre iptal hakkı Niba Tarım'ın inisiyatifindedir.
          </p>
          <p>3- Fiyatlar stok durumuna göre değişiklik gösterebilir.</p>
        </div>
      </div>
    </main>
  );
}

const td = {
  border: "1px solid black",
  padding: 8,
};

const tdBold = {
  ...td,
  fontWeight: 700,
};

const tdRight = {
  ...td,
  textAlign: "right" as const,
};

export default function Page() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <PreviewContent />
    </Suspense>
  );
}