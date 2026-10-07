import type { Metadata } from 'next';
import Link from 'next/link';
import { Shell, Intro, s, Photo, WhatsApp } from '../../_public/site';

const url = 'https://www.nibatarim.com/blog/toptan-gubre-bayiler-icin-tedarik-rehberi';
const title = 'Toptan Gübre ve Gübre Fiyatları: Tarım Bayileri İçin Tedarik Rehberi';
const description = 'Toptan gübre arayan tarım bayileri için gübre fiyatları, 50 kg çuval ve bigbag seçenekleri, ton fiyatı ve teslimat koşullarını değerlendirme rehberi.';

export const metadata: Metadata = {
  title: `${title} | Niba Tarım`,
  description,
  alternates: { canonical: url },
  keywords: ['toptan gübre', 'gübre fiyatları', 'gübre ne kadar', 'gübre kaç para', 'gübre ton fiyatı', '50 kg gübre fiyatı', 'bigbag gübre', 'gübre tedarikçisi', 'tarım bayileri', 'bayilere gübre tedariği', 'üre gübre fiyatı', 'DAP gübre fiyatı', 'CAN 26 gübre fiyatı', 'kompoze gübre fiyatları'],
  openGraph: { title, description, url, type: 'article', locale: 'tr_TR', siteName: 'Niba Tarım', publishedTime: '2026-10-07T12:00:00+03:00', images: [{ url: 'https://www.nibatarim.com/site/fertilizer-urea-bags.jpg', width: 1672, height: 941, alt: '50 kg gübre çuvalları, bigbag ve granül üre' }] },
};

const article = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: title,
  description,
  mainEntityOfPage: url,
  datePublished: '2026-10-07T12:00:00+03:00',
  dateModified: '2026-10-07T12:00:00+03:00',
  image: 'https://www.nibatarim.com/site/fertilizer-urea-bags.jpg',
  author: { '@type': 'Organization', name: 'Niba Tarım', url: 'https://www.nibatarim.com/hakkimizda' },
  publisher: { '@type': 'Organization', name: 'Niba Tarım', logo: { '@type': 'ImageObject', url: 'https://www.nibatarim.com/niba-logo-horizontal.png' } },
};

export default function WholesaleGuide() {
  return (
    <Shell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <Intro label="Tarım rehberi" title="Toptan gübre ve gübre fiyatları" text="Tarım bayileri için ürün, ambalaj, fiyat ve teslimat koşullarını birlikte değerlendirme rehberi." />
      <section className={s.section}>
        <div className={`${s.container} ${s.articleLayout}`}>
          <article className={s.article}>
            <p className={s.articleMeta}>Niba Tarım · <time dateTime="2026-10-07">7 Ekim 2026</time></p>
            <div className={s.articleImage}><Photo src="/site/fertilizer-urea-bags.jpg" alt="Palet üzerindeki 50 kg gübre çuvalları, bigbag ve granül üre" /></div>
            <p>Toptan gübre satın alırken doğru ürün kadar, teklifin kapsamını ve teslimat koşullarını bilmek de önemlidir. Tarım bayileri, zirai girdi bayileri ve tarımsal işletmeler için gübre fiyatlarını karşılaştırmak; ürünün niteliğini, ambalajını, toplam tonajı ve nakliye bedelini birlikte değerlendirmeyi gerektirir.</p>
            <p>“Gübre ne kadar?” sorusunun tek bir yanıtı yoktur. Üre, DAP, CAN 26 ve kompoze gübre gibi farklı ürün grupları ayrı değerlendirilir. Bu rehber, güncel bir fiyat teklifi istemeden önce hangi bilgileri hazırlamanız gerektiğini ve gübre tedarikçisi seçerken nelere bakabileceğinizi açıklar.</p>
            <nav className={s.articleToc} aria-label="Yazı içeriği"><strong>Bu yazıda</strong><a href="#fiyat">Gübre fiyatları ve ton fiyatı</a><a href="#ambalaj">50 kg çuval ve bigbag</a><a href="#urun">Ürün grupları</a><a href="#tedarik">Bayi tedariği ve teklif karşılaştırması</a><a href="#sorular">Sık sorulan sorular</a></nav>

            <h2 id="fiyat">Gübre fiyatları neye göre değişir?</h2>
            <p>Gübre fiyatı araştırırken önce ürün adını ve istenen miktarı netleştirin. Aynı başlık altında sunulan teklifler; ürün grubu, marka, ambalaj ve teslim şekli bakımından farklı olabilir. Teklif tarihi de önemlidir: önceki bir dönemde alınan fiyatın bugün geçerli olduğu varsayılmamalıdır.</p>
            <ul><li><strong>Ürün ve marka:</strong> Teklifte ürünün tam adı ve ambalaj bilgisi bulunmalı.</li><li><strong>Miktar:</strong> Toplam tonaj ile çuval veya bigbag adedi açıkça belirtilmeli.</li><li><strong>Teslimat:</strong> Depodan teslim ve adrese teslim teklifleri aynı kapsamda karşılaştırılmalı.</li><li><strong>Nakliye ve diğer kalemler:</strong> Taşıma, yükleme, boşaltma ve vergi bilgileri teklifte netleştirilmeli.</li><li><strong>Ödeme ve geçerlilik:</strong> Ödeme koşulları ve fiyatın geçerli olduğu süre yazılı olarak paylaşılmalı.</li></ul>
            <h3>Gübre ton fiyatı nasıl karşılaştırılır?</h3>
            <p>Bir ton gübre fiyatını karşılaştırırken yalnızca birim fiyata bakmak yeterli değildir. İki teklifin aynı ürünü ve aynı teslim koşullarını kapsadığından emin olun. Bayinize ulaşan toplam maliyeti görmek için ürün bedeli ile size yansıtılan diğer kalemleri birlikte değerlendirin.</p>

            <h2 id="ambalaj">50 kg gübre çuvalı mı, bigbag mi?</h2>
            <p>50 kg gübre çuvalları ve bigbag ambalajlar farklı stok ve sevkiyat düzenlerine uygun seçeneklerdir. Tercihi yaparken deponuzdaki alanı, boşaltma olanaklarını ve müşterilerinizin talep ettiği ambalajı dikkate alın. Bigbag kapasitesi ve net ağırlığı için ürün etiketini ve teklif bilgisini esas alın.</p>
            <p>“50 kg gübre fiyatı” ile “gübre ton fiyatı” arasında hesap yaparken 20 adet 50 kg çuvalın 1.000 kg, yani bir ton ettiğini unutmayın. Ancak fiyat karşılaştırmasının anlamlı olması için marka, ürün ve teslim koşullarının da aynı olması gerekir.</p>
            <p>Örneğin 27 tonluk bir talepte, yalnızca ürün fiyatını sormak yerine “50 kg çuval ambalajlı 27 ton ürün, belirtilen ilçeye teslim” şeklinde bilgi vermek teklifin kapsamını netleştirir. Bu örnek bir fiyat veya stok taahhüdü değildir.</p>

            <h2 id="urun">Üre, DAP, CAN 26 ve kompoze gübre fiyatları</h2>
            <p>Üre gübre fiyatı, DAP gübre fiyatı, CAN 26 gübre fiyatı ve kompoze gübre fiyatları ayrı ürün talepleri olarak değerlendirilmelidir. Teklif isterken yalnızca “gübre” demek yerine ürünün tam adını, tercih edilen markayı ve ambalajı yazın. Kompoze gübre taleplerinde ürünün etiketindeki formül bilgisini de paylaşın.</p>
            <p>Ürün seçimi ve uygulama miktarı; bitki, toprak ve üretim koşullarına göre değerlendirilmelidir. Bu yazı tedarik ve fiyat karşılaştırması içindir. Ürünlerinizi seçerken toprak analizi ve yetkin ziraat uzmanlarının önerilerini dikkate alın.</p>
            <p>İlgili yazılar: <Link href="/blog/gubre-fiyatlari">gübre fiyatlarını etkileyen faktörler</Link> ve <Link href="/blog/can-26-gubre-fiyati">CAN 26 gübre tedarik rehberi</Link>.</p>

            <h2 id="tedarik">Tarım bayileri gübre tedarikçisi seçerken nelere bakmalı?</h2>
            <p>Toptan gübre tedarikçisi seçerken fiyatın yanında iletişimin açıklığına ve teklif bilgilerinin tutarlılığına bakın. Ürünün bulunabilirliği, sevkiyat planı, ambalaj durumu ve teslimat zamanı sipariş öncesinde konuşulmalı. Plan değişikliği olduğunda hangi kanaldan bilgi alacağınızı da belirleyin.</p>
            <p>Niba Tarım, 80 yılı aşkın tarım ticareti, zahirecilik ve gübre ticareti deneyiminden aldığı birikimle bayiler ve tarımsal işletmelerin ihtiyaçlarını değerlendirir. Çalışma anlayışımızı <Link href="/hakkimizda">Hakkımızda sayfasında</Link>, ürün gruplarımızı <Link href="/urunler">Ürünler bölümünde</Link> inceleyebilirsiniz.</p>
            <h3>Bayilere toptan gübre teklifi için hangi bilgiler gerekir?</h3>
            <ul><li>İstenen ürünün tam adı ve varsa marka tercihi</li><li>Toplam miktar: tonaj ve ambalaj seçimi</li><li>Teslimat ili, ilçesi ve teslim noktası</li><li>Planlanan teslim tarihi</li><li>Firma veya bayi adı ve iletişim bilgisi</li></ul>
            <p>Bu bilgiler, ihtiyaçlarınıza uygun bir teklif hazırlanmasını kolaylaştırır. Güncel stok, fiyat ve teslimat koşulları için <Link href="/iletisim">Niba Tarım ile iletişime geçin</Link>.</p>

            <h2 id="sorular">Sık sorulan sorular</h2>
            <h3>Gübre ne kadar, gübre kaç para?</h3>
            <p>Gübre fiyatı ürüne, miktara, ambalaja ve teslim koşullarına göre belirlenir. Güncel gübre fiyatları için ürün adı, tonaj ve teslimat lokasyonunu paylaşarak tarihli teklif isteyin. Bu sayfada sabit veya doğrulanmamış fiyat rakamları yayımlamıyoruz.</p>
            <h3>Toptan gübre fiyatları ile çuval fiyatları aynı mı?</h3>
            <p>Çuval fiyatı ve ton fiyatı farklı birimlerle ifade edilir. Birimleri eşitledikten sonra tekliflerin ürün, ambalaj, ödeme ve nakliye kapsamını da karşılaştırın.</p>
            <h3>Bigbag gübre fiyatı nasıl sorulur?</h3>
            <p>Ürün adını, talep ettiğiniz toplam tonajı ve bigbag ambalaj tercihinizi yazın. Her bigbagin net ağırlığını ve teslimat şartlarını teklif üzerinde teyit edin.</p>
            <h3>Niba Tarım’dan bayi için fiyat teklifi nasıl alınır?</h3>
            <p>WhatsApp üzerinden ürün ve teslimat bilgilerinizi iletebilir veya <Link href="/iletisim">iletişim sayfamızdaki</Link> telefon ve e-posta kanallarını kullanabilirsiniz.</p>
            <WhatsApp />
          </article>
          <aside className={s.aside}><span className={s.eyebrow}>BAYİ TEDARİĞİ</span><h3>Toptan gübre teklifi alın</h3><p>Ürün adı, tonaj, ambalaj ve teslimat ilinizi paylaşın.</p><WhatsApp /><p className={s.asideLinks}><Link href="/urunler#gubre">Gübre grubunu inceleyin ↗</Link><br /><Link href="/blog">Diğer rehberler ↗</Link></p></aside>
        </div>
      </section>
    </Shell>
  );
}
