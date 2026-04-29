import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";

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
        {children}
        <Analytics />
      </body>
    </html>
  );
}