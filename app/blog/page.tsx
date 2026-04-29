export const metadata = {
  title: "Niba Tarım Blog | Gübre, Yem ve Tarımsal Girdi Rehberi",
  description:
    "Gübre fiyatları, toptan gübre, yem ve tarımsal girdiler hakkında güncel bilgiler.",
};

const latestPosts = [
  {
    title: "2026 Güncel Gübre Fiyatları",
    desc: "CAN 26, üre, DAP ve kompoze gübre fiyatları hakkında güncel bilgiler.",
    href: "/blog/gubre-fiyatlari",
    image: "/blog/gubre.jpg",
    date: "2026",
  },
  {
    title: "Toptan Gübre Alırken Nelere Dikkat Edilmeli?",
    desc: "Bayi ve tarımsal işletmeler için tedarik, sevkiyat ve fiyat süreçleri.",
    href: "#",
    image: "/blog/gubre.jpg",
    date: "Yakında",
  },
  {
    title: "CAN 26 Gübre Nedir?",
    desc: "CAN 26 gübrenin kullanım alanları ve fiyatı etkileyen faktörler.",
    href: "#",
    image: "/blog/gubre.jpg",
    date: "Yakında",
  },
];

const sections = [
  {
    title: "Gübre Rehberi",
    posts: latestPosts,
  },
  {
    title: "Yem ve Hayvancılık",
    posts: [
      {
        title: "Yem Tedarikinde Fiyatı Etkileyen Faktörler",
        desc: "Yem grubu ürünlerinde kalite, lojistik ve tedarik sürekliliği.",
        href: "#",
        image: "/blog/gubre.jpg",
        date: "Yakında",
      },
      {
        title: "Büyükbaş İşletmeler İçin Yem Planlaması",
        desc: "Tarımsal işletmelerde doğru yem tedariki için temel noktalar.",
        href: "#",
        image: "/blog/gubre.jpg",
        date: "Yakında",
      },
      {
        title: "Yem Alımında B2B Tedarik Avantajı",
        desc: "Bayi ve işletmeler için düzenli tedarik süreçlerinin önemi.",
        href: "#",
        image: "/blog/gubre.jpg",
        date: "Yakında",
      },
    ],
  },
  {
    title: "Tarımsal Girdi Tedariki",
    posts: [
      {
        title: "Tarımsal Girdi Tedarikinde Güvenilir İş Ortağı Seçimi",
        desc: "Bayiler için sürdürülebilir tedarik ağının önemi.",
        href: "#",
        image: "/blog/gubre.jpg",
        date: "Yakında",
      },
      {
        title: "Sezon Öncesi Girdi Planlaması Nasıl Yapılır?",
        desc: "Stok, fiyat ve teslimat süreçlerinde dikkat edilmesi gerekenler.",
        href: "#",
        image: "/blog/gubre.jpg",
        date: "Yakında",
      },
      {
        title: "Tedarik Sürecinde Hızlı Teklifin Önemi",
        desc: "B2B tarım ticaretinde zamanında fiyat almanın avantajları.",
        href: "#",
        image: "/blog/gubre.jpg",
        date: "Yakında",
      },
    ],
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <a href="/">
            <img
              src="/niba-logo-horizontal.png"
              alt="Niba Tarım"
              className="h-14 w-auto"
            />
          </a>

          <nav className="hidden items-center gap-8 text-sm font-black uppercase tracking-wide text-slate-800 md:flex">
            <a href="/">Ana Sayfa</a>
            <a href="/#urunler">Ürünlerimiz</a>
            <a href="/#markalar">Markalarımız</a>
            <a href="/#iletisim">İletişim</a>
          </nav>
        </div>
      </header>

      <section className="bg-[#f5f7f1] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="text-sm font-semibold text-slate-500">
            <a href="/" className="hover:text-emerald-800">
              Niba Tarım
            </a>
            <span className="mx-2">›</span>
            <span>Blog</span>
          </div>

          <h1 className="mt-8 text-5xl font-black tracking-tight text-slate-950">
            Niba Tarım Blog
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Gübre, yem ve tarımsal girdi tedariki hakkında bayiler ve tarımsal
            işletmeler için faydalı içerikler.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <h2 className="text-2xl font-black text-slate-950">
          En Son Eklenenler
        </h2>

        <div className="mt-8 grid gap-7 md:grid-cols-3">
          {latestPosts.map((post) => (
            <FeaturedCard key={post.title} post={post} />
          ))}
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <h2 className="text-3xl font-black text-slate-950">
              {section.title}
            </h2>
            <a
              href="#"
              className="hidden rounded-full border border-emerald-900/20 px-5 py-2 text-sm font-black text-emerald-900 transition hover:bg-emerald-900 hover:text-white sm:inline-flex"
            >
              Daha çok {section.title}
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {section.posts.map((post) => (
              <PostCard key={`${section.title}-${post.title}`} post={post} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10 bg-[#08251c] px-6 py-16 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <h2 className="text-4xl font-black">
              Güncel gübre ve yem fiyatı almak ister misiniz?
            </h2>
            <p className="mt-4 max-w-2xl leading-8 text-white/70">
              Ürün, miktar ve teslimat lokasyonunu paylaşın; size en uygun
              fiyatla dönüş yapalım.
            </p>
          </div>

          <a
            href="https://wa.me/905334928522"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-green-500 px-7 py-4 text-center font-black text-white transition hover:bg-green-600"
          >
            WhatsApp’tan Fiyat Al
          </a>
        </div>
      </section>
    </main>
  );
}

function FeaturedCard({
  post,
}: {
  post: { title: string; desc: string; href: string; image: string; date: string };
}) {
  return (
    <a
      href={post.href}
      className="group overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="h-56 overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      <div className="p-6">
        <p className="text-sm font-bold text-emerald-800">{post.date}</p>
        <h3 className="mt-3 text-2xl font-black leading-tight text-slate-950">
          {post.title}
        </h3>
        <p className="mt-3 leading-7 text-slate-600">{post.desc}</p>
        <p className="mt-5 font-black text-emerald-900">Devamını oku</p>
      </div>
    </a>
  );
}

function PostCard({
  post,
}: {
  post: { title: string; desc: string; href: string; image: string; date: string };
}) {
  return (
    <a
      href={post.href}
      className="group grid grid-cols-[120px_1fr] gap-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"
    >
      <img
        src={post.image}
        alt={post.title}
        className="h-28 w-full rounded-xl object-cover"
      />
      <div>
        <p className="text-xs font-bold text-emerald-800">{post.date}</p>
        <h3 className="mt-2 font-black leading-tight text-slate-950">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
          {post.desc}
        </p>
      </div>
    </a>
  );
}