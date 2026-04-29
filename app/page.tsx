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

const productSchema = {
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

const faqSchema = {
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

const services = [
  {
    icon: "🌱",
    title: "Gübre Grubu",
    text: "Bayiler ve tarımsal işletmeler için farklı gübre çeşitlerinde güvenilir tedarik çözümleri.",
  },
  {
    icon: "🐄",
    title: "Yem Grubu",
    text: "Büyükbaş ve küçükbaş hayvancılık için kaliteli yem çeşitlerinde tedarik desteği.",
  },
  {
    icon: "🚜",
    title: "Diğer Tarım Ürünleri",
    text: "Tarımsal işletmelerin ihtiyaç duyduğu farklı ürün gruplarında hızlı ve güvenilir tedarik.",
  },
];

const stats = [
  { value: "50+", label: "İş Ortağı", icon: "▦" },
  { value: "25+", label: "İl ve İlçe", icon: "🚜" },
  { value: "1000+", label: "Mutlu Bayi", icon: "♟" },
  { value: "15+", label: "Yıllık Tecrübe", icon: "☘" },
];

const brands = [
  { name: "Uralchem", image: "/brands/uralchem.png" },
  { name: "Bagfaş", image: "/brands/bagfas.png" },
  { name: "Eti Bakır", image: "/brands/eti-bakir.png" },
  { name: "İGSAŞ", image: "/brands/igsas.png" },
];

const heroImage = "/hero-tractor.jpg";

const aboutImage =
  "https://images.unsplash.com/photo-1560493676-04071c5f467b?q=80&w=2000&auto=format&fit=crop";

const contactImage =
  "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=900&auto=format&fit=crop";

export default function NibaTarimHomepage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Header />
      <Hero />
      <Products />
      <About />
      <Brands />
      <Contact />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <a href="#" className="flex items-center gap-3" aria-label="Niba Tarım ana sayfa">
          <img
            src="/niba-logo-horizontal.png"
            alt="Niba Tarım Logo"
            className="h-16 w-auto object-contain"
          />
        </a>

        <nav className="hidden items-center gap-8 text-sm font-black uppercase tracking-wide text-slate-800 lg:flex">
          <a className="text-emerald-800" href="#">
            Ana Sayfa
          </a>
          <a href="#hakkimizda">Hakkımızda</a>
          <a href="#urunler">Ürünlerimiz</a>
          <a href="#markalar">Markalarımız</a>
          <a href="/blog">Blog</a>
          <a href="#iletisim">İletişim</a>
        </nav>

        <a href="tel:+905334928522" className="hidden items-center gap-3 lg:flex">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-600 text-xl text-emerald-700">
            ☎
          </div>
          <div className="leading-tight">
            <p className="text-xs font-black uppercase text-slate-500">Bize Ulaşın</p>
            <p className="text-xl font-black text-slate-950">0 (533) 492 85 22</p>
          </div>
        </a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      className="relative min-h-[720px] overflow-hidden"
      style={{
        backgroundImage: `url(${heroImage})`,
        backgroundSize: "cover",
        backgroundPosition: "95% center",
      }}
    >
      <div className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-emerald-900 drop-shadow-[0_2px_6px_rgba(255,255,255,0.65)] md:text-7xl">
            Gübrede Kalite,
            <span className="block text-emerald-800">Alışverişte Güven</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg font-medium leading-8 text-slate-800 drop-shadow-[0_1px_5px_rgba(255,255,255,0.8)]">
  Kaliteli ürünlerimiz ve güçlü iş ortaklarımızla <br />
  tarımın her aşamasında yanınızdayız.
</p>
          <div className="mt-8">
            <a
              href="https://wa.me/905334928522"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-800 px-6 py-4 text-sm font-black uppercase tracking-wide text-white shadow-xl transition hover:bg-emerald-700"
            >
              Whatsapp'dan Fiyat Alın →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Products() {
  return (
    <section id="urunler" className="relative z-10 mx-auto -mt-10 max-w-7xl px-6 lg:px-8">
      <div className="grid overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-100 md:grid-cols-3">
        {services.map((service) => (
          <ServiceBox key={service.title} icon={service.icon} title={service.title} text={service.text} />
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="hakkimizda" className="relative mt-8 overflow-hidden bg-[#071f17] py-16 text-white">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{
          backgroundImage: `url(${aboutImage})`,
        }}
      />
      <div className="absolute inset-0 bg-emerald-950/80" />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[1fr_1.5fr] lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.28em] text-lime-400">Hakkımızda</p>
          <h2 className="mt-4 text-4xl font-black leading-tight md:text-5xl">
            Niba Tarım ile Güvenilir Tedarik, Kesintisiz Hizmet
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Stat key={stat.label} value={stat.value} label={stat.label} icon={stat.icon} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Brands() {
  return (
    <section id="markalar" className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-6 text-center lg:px-8">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-emerald-800">Markalarımız</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
          Güçlü Markalar, Verimli Yarınlar
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Kaliteli ürün ve hizmet anlayışımızı, sektörünün lider markalarıyla güç birliği yaparak sürdürüyoruz.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-6">
          {brands.map((brand) => (
            <BrandLogo key={brand.name} name={brand.name} image={brand.image} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="iletisim" className="border-y border-slate-100 bg-slate-50 py-10">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[260px_1fr_1.45fr] lg:items-center lg:px-8">
        <img
          src={contactImage}
          alt="Tarım ürünleri teklif formu"
          className="h-36 w-full rounded-2xl object-cover shadow-sm"
        />

        <div>
          <h2 className="text-3xl font-black text-slate-950">Size Nasıl Yardımcı Olabiliriz?</h2>
          <p className="mt-3 leading-7 text-slate-600">
            İhtiyacınız olan ürün veya hizmet hakkında bilgi almak için bizimle iletişime geçin, en kısa sürede size dönüş yapalım.
          </p>
        </div>

        <form className="grid gap-4 md:grid-cols-2">
          <input
            className="rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-700"
            placeholder="Adınız Soyadınız"
          />
          <input
            className="rounded-md border border-slate-200 bg-white px-4 py-3 outline-none focus:border-emerald-700"
            placeholder="Telefon Numaranız"
          />
          <select className="rounded-md border border-slate-200 bg-white px-4 py-3 text-slate-500 outline-none focus:border-emerald-700">
            <option>İl Seçiniz</option>
            <option>Bursa</option>
            <option>Balıkesir</option>
            <option>Çanakkale</option>
            <option>Diğer</option>
          </select>
          <button
            type="button"
            className="rounded-md bg-emerald-900 px-5 py-3 font-black uppercase tracking-wide text-white transition hover:bg-emerald-800"
          >
            Gönder
          </button>
        </form>
      </div>

      <div className="mx-auto mt-10 max-w-7xl px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow">
          <iframe
            src="https://www.google.com/maps?q=Esentepe%20Mah.%20B%C3%BCy%C3%BCkdere%20Cad.%20No%3A199%2F-6%20%C5%9Ei%C5%9Fli%20%C4%B0stanbul&output=embed"
            width="100%"
            height="350"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Niba Tarım Harita Konumu"
          />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#08251c] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-4 lg:px-8">
        <div>
          <img src="/niba-logo-white.png" alt="Niba Tarım Logo" className="h-14 w-auto" />
          <p className="mt-5 leading-7 text-white/75">Tarımın her aşamasında güvenilir çözüm ortağınız.</p>
        </div>

        <FooterCol title="Hakkımızda" items={["Hakkımızda", "Vizyon & Misyon", "Kalite Politikamız", "İletişim"]} />
        <FooterCol title="Ürünlerimiz" items={["Gübre Grubu", "Yem Grubu", "Diğer Tarım Ürünleri"]} />

        <div>
          <h3 className="font-black uppercase tracking-wide">İletişim</h3>
          <div className="mt-5 space-y-3 text-sm leading-6 text-white/75">
            <p>Esentepe Mah. Büyükdere Cad. No:199/-6 Şişli / İstanbul</p>
            <p>0 (533) 492 85 22</p>
            <p>info@nibatarim.com</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/55">
        © 2026 Niba Tarım. Tüm hakları saklıdır.
      </div>
    </footer>
  );
}

function ServiceBox({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <article className="group border-b border-slate-100 p-7 transition hover:bg-slate-50 md:border-b-0 md:border-r last:border-r-0">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-emerald-950 text-2xl text-white">
        {icon}
      </div>
      <h3 className="text-xl font-black leading-tight text-slate-950">{title}</h3>
      <p className="mt-4 min-h-20 leading-7 text-slate-600">{text}</p>
      <div className="mt-4 text-2xl font-black text-lime-600 transition group-hover:translate-x-1">→</div>
    </article>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <div className="group relative flex h-40 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/0 p-5 text-center backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-tr from-lime-400/10 via-transparent to-emerald-400/10 opacity-0 transition group-hover:opacity-100" />
      <div className="relative mb-2 text-2xl text-lime-400">{icon}</div>
      <p className="relative text-4xl font-black leading-none text-white">{value}</p>
      <div className="relative my-2 h-px w-8 bg-lime-400/60" />
      <p className="relative max-w-[120px] text-xs font-semibold uppercase leading-tight tracking-wide text-white/70">
        {label}
      </p>
    </div>
  );
}

function BrandLogo({ name, image }: { name: string; image: string }) {
  return (
    <div className="flex h-32 min-w-[210px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <img src={image} alt={`${name} logo`} className="max-h-20 max-w-full object-contain" />
    </div>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="font-black uppercase tracking-wide">{title}</h3>
      <ul className="mt-5 space-y-2 text-sm text-white/75">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export const pageContentChecks = {
  hasAboutMenu: true,
  hasServicesMenu: false,
  hasBrandsSection: true,
  hasHeroCta: true,
  hasMapEmbed: true,
  hasCorrectPhone: true,
};
