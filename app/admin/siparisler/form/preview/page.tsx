"use client";

import { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function PreviewContent() {
  const params = useSearchParams();
  const pdfRef = useRef<HTMLDivElement>(null);

  const bayi = params.get("bayi") || "-";
  const tarih = params.get("tarih") || "-";
  const odeme = params.get("odeme") || "-";
  const depo = params.get("depo") || "-";
  const nakliye = params.get("nakliye") || "-";
  const urun = params.get("urun") || "-";
  const miktar = params.get("miktar") || "0";
  const fiyat = params.get("fiyat") || "0";
  const toplam = Number(params.get("toplam") || 0);

  const fiyatNumber = Number(fiyat.replace(",", "."));

  const toplamFormatted = toplam.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const fiyatFormatted = fiyatNumber.toLocaleString("tr-TR", {
    maximumFractionDigits: 2,
  });

  const tarihFormatted =
    tarih && tarih !== "-"
      ? new Date(tarih).toLocaleDateString("tr-TR")
      : "-";

  async function downloadPdf() {
    if (!pdfRef.current) return;

    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = 297;
    const pageHeight = 210;

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const y = imgHeight < pageHeight ? (pageHeight - imgHeight) / 2 : 0;

    pdf.addImage(imgData, "PNG", 0, y, imgWidth, Math.min(imgHeight, pageHeight));
    pdf.save(`siparis-formu-${bayi}.pdf`);
  }

  return (
    <main style={{ minHeight: "100vh", background: "#ffffff", padding: 24 }}>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={downloadPdf}
          style={{
            borderRadius: 12,
            background: "#003e2f",
            color: "#ffffff",
            padding: "12px 20px",
            fontWeight: 700,
          }}
        >
          PDF İndir
        </button>
      </div>

      <div
        ref={pdfRef}
        style={{
          width: 1120,
          minHeight: 780,
          margin: "0 auto",
          background: "#ffffff",
          color: "#000000",
          padding: 40,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900 }}>Sipariş Formu</h1>

            <div style={{ marginTop: 40, fontSize: 18, lineHeight: 1.8 }}>
              <p>Niba Tarım Sanayi Ve Ticaret Limited Şirketi</p>
              <p>
                Esentepe Mah. Büyükdere Cad. No:199/-6
                <br />
                Şişli/İstanbul
              </p>
              <p>Zincirlikuyu VD VKN: 6311960146</p>
            </div>

            <div style={{ marginTop: 60 }}>
              <p style={{ fontSize: 18, fontWeight: 900 }}>Sayın;</p>
              <p style={{ marginTop: 32, fontSize: 18 }}>{bayi}</p>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <img
              src="/niba-logo-horizontal.png"
              alt="Niba Tarım"
              style={{
                height: 180,
                width: "auto",
                objectFit: "contain",
              }}
            />

            <div
              style={{
                marginTop: 56,
                display: "grid",
                gridTemplateColumns: "160px 1fr",
                gap: "8px 24px",
                textAlign: "left",
                fontSize: 18,
              }}
            >
              <p style={{ fontWeight: 900 }}>Sipariş Tarihi:</p>
              <p>{tarihFormatted}</p>
              <p style={{ fontWeight: 900 }}>Ödeme Şekli:</p>
              <p>{odeme}</p>
              <p style={{ fontWeight: 900 }}>Ödeme Vadesi:</p>
              <p>-</p>
              <p style={{ fontWeight: 900 }}>Nakliye Durumu:</p>
              <p>{nakliye}</p>
              <p style={{ fontWeight: 900 }}>Çıkış Deposu:</p>
              <p>{depo}</p>
            </div>
          </div>
        </div>

        <table
          style={{
            marginTop: 72,
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 17,
          }}
        >
          <thead>
            <tr style={{ background: "#003e2f", color: "#ffffff" }}>
              <th style={{ padding: 8, textAlign: "left" }}>Malın Cinsi</th>
              <th style={{ padding: 8, textAlign: "left" }}>Miktar</th>
              <th style={{ padding: 8, textAlign: "left" }}>Birim</th>
              <th style={{ padding: 8, textAlign: "left" }}>Birim Fiyat</th>
              <th style={{ padding: 8, textAlign: "left" }}>Sevk Adresi</th>
              <th style={{ padding: 8, textAlign: "left" }}>Peşin Tutar (TL)</th>
              <th style={{ padding: 8, textAlign: "left" }}>Vadeli Tutar (TL)</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td style={{ padding: 8 }}>{urun}</td>
              <td style={{ padding: 8 }}>{miktar}</td>
              <td style={{ padding: 8 }}>Ton</td>
              <td style={{ padding: 8 }}>{fiyatFormatted}</td>
              <td style={{ padding: 8 }}>-</td>
              <td style={{ padding: 8 }}>{toplamFormatted}</td>
              <td style={{ padding: 8 }}>-</td>
            </tr>
          </tbody>
        </table>

        <div style={{ marginTop: 48, marginLeft: "auto", width: 420, fontSize: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              rowGap: 8,
            }}
          >
            <p style={{ fontWeight: 900 }}>KDV Hariç Toplam:</p>
            <p style={{ textAlign: "right" }}>{toplamFormatted}</p>
            <p style={{ fontWeight: 900 }}>Toplam KDV:</p>
            <p style={{ textAlign: "right" }}>0,00</p>
            <p style={{ fontWeight: 900 }}>Genel Toplam</p>
            <p style={{ textAlign: "right" }}>{toplamFormatted}</p>
          </div>
        </div>

        <div style={{ marginTop: 80, fontSize: 13, lineHeight: 1.6 }}>
          <p>
            1- Ödeme gününde ödemesi tamamlanmayan siparişlerin iptal hakkı
            Niba Tarım&apos;ın insiyatifindedir.
          </p>
          <p>
            2- 10 gün içerisinde sevk edilmeyen tüm siparişlerin, piyasa koşulları
            ve tedarik riskine göre iptal hakkı Niba Tarım&apos;ın
            insiyatifindedir.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={<div>Yükleniyor...</div>}>
      <PreviewContent />
    </Suspense>
  );
}