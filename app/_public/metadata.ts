export const metadata = {
  title: "Niba Tarım | Gübre Fiyatları, Yem ve Tarımsal Girdi Tedariki",
  description:
    "Niba Tarım; gübre fiyatları, toptan gübre, CAN 26, üre gübre, DAP gübre, kompoze gübre, yem ve tarımsal girdi tedarikinde bayilere ve tarımsal işletmelere hızlı teklif sunar.",
  keywords: [
    "gübre fiyatları",
    "toptan gübre",
    "gübre tedariki",
    "CAN 26 gübre",
    "üre gübre fiyatları",
    "DAP gübre fiyatları",
    "kompoze gübre",
    "tarımsal girdi tedariki",
    "yem tedariki",
    "Niba Tarım",
  ],
  alternates: {
    canonical: "https://www.nibatarim.com",
  },
  openGraph: {
    title: "Niba Tarım | Gübre Tedariğinde Güçlü Çözüm Ortağınız",
    description:
      "Gübre, yem ve tarımsal girdilerde güçlü tedarik ağı, hızlı teklif ve rekabetçi fiyat avantajı.",
    url: "https://www.nibatarim.com",
    siteName: "Niba Tarım",
    locale: "tr_TR",
    type: "website",
  },
};

export const productSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Niba Tarım",
  url: "https://www.nibatarim.com",
  image: "https://www.nibatarim.com/niba-logo-horizontal.png",
  description:
    "Gübre, yem ve tarımsal girdi tedarikinde bayilere ve tarımsal işletmelere hizmet veren B2B tarım ticaret firması.",
  areaServed: "Türkiye",
  email: "info@nibatarim.com",
  telephone: "+905334928522",
};

export const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Niba Tarım hangi ürünlerde tedarik hizmeti sunar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Niba Tarım; gübre, yem ve farklı tarımsal girdi gruplarında bayilere ve tarımsal işletmelere B2B tedarik hizmeti sunar.",
      },
    },
    {
      "@type": "Question",
      name: "Gübre fiyat teklifi nasıl alınır?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ürün adı, miktar ve teslimat lokasyonunuzu paylaşarak CAN 26, üre, DAP, kompoze gübre ve diğer gübre çeşitleri için hızlı fiyat teklifi alabilirsiniz.",
      },
    },
  ],
};

