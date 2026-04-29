import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Niba Tarım",
  description: "Gübre, yem ve tarımsal girdi tedarikinde güvenilir çözüm ortağınız.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-white text-slate-900">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XQDP14BTCJ"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XQDP14BTCJ');
          `}
        </Script>

        {children}
        <Analytics />
      </body>
    </html>
  );
}