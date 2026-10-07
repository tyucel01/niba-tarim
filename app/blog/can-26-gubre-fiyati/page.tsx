import { Shell, s, WhatsApp, Intro } from '../../_public/site';
export const metadata = {
  title: "CAN 26 Gübre Fiyatı 2026 | Güncel Liste ve Teklif Al",
  description:
    "CAN 26 gübre fiyatı 2026 yılı güncel bilgileri. Toptan CAN 26 gübre fiyatı almak için hemen teklif alın.",
};

export default function Page() {
  return (
    <Shell><Intro label="Tarım rehberi" title="CAN 26 gübre ve tedarik rehberi" text="Ürün, miktar ve teslimat koşullarını değerlendirerek tedarik ihtiyacınızı planlayın."/>
      <section className={`${s.container} ${s.section} ${s.article}`}>



        {/* HERO GÖRSEL */}
        <div className="mt-8 overflow-hidden rounded-3xl shadow-lg">
          <img
            src="/site/canola-field.jpg"
            alt="Kanola tarlası"
            className="w-full h-[420px] object-cover"
          />
        </div>

        <p className="mt-8 text-lg leading-8 text-slate-700">
          CAN 26 gübre fiyatı 2026 yılında döviz kuru, hammadde maliyetleri ve
          sezonluk talebe bağlı olarak değişiklik göstermektedir. Özellikle ekim
          dönemlerinde fiyatlarda hareketlilik gözlemlenmektedir.
        </p>

        <h2 className="mt-12 text-2xl font-black text-emerald-900">
          CAN 26 gübre nedir?
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          CAN 26 gübre, %26 azot içeren kalsiyum amonyum nitrat bazlı bir gübredir.
          Bitki gelişimini destekler ve özellikle tahıl üretiminde yaygın olarak kullanılır.
        </p>

        {/* GÖRSEL */}
        <div className="my-10">
          <img
            src="/site/corn-field.jpg"
            alt="Yeşil mısır tarlası"
            className="w-full h-[350px] object-cover rounded-2xl shadow-md"
          />
        </div>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          CAN 26 gübre fiyatı neye göre değişir?
        </h2>

        <ul className="mt-4 space-y-2 text-slate-700">
          <li>• Döviz kuru</li>
          <li>• Hammadde maliyetleri</li>
          <li>• Talep yoğunluğu</li>
          <li>• Sipariş miktarı</li>
          <li>• Teslimat lokasyonu</li>
        </ul>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          Toptan CAN 26 gübre fiyatı
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          Toptan CAN 26 gübre fiyatları, sipariş miktarına göre değişmektedir.
          Büyük hacimli alımlarda daha avantajlı fiyatlar sunulmaktadır.
        </p>

        <div className="my-8">
          <img
            src="/site/canola-field.jpg"
            alt="Kanola tarlası"
            className="w-full h-[350px] object-cover rounded-2xl shadow-md"
          />
        </div>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          Güncel CAN 26 gübre fiyatı nasıl alınır?
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          En doğru CAN 26 gübre fiyatını almak için ürün miktarı ve teslimat
          lokasyonu bilgisi gereklidir. Niba Tarım olarak hızlı ve rekabetçi
          fiyat teklifleri sunuyoruz.
        </p>

        {/* CTA */}
        <div className={s.aside}><h3>Güncel teklif alın</h3><p>Ürün, tonaj ve teslimat ilinizi bize iletin.</p><WhatsApp/></div>

      </section>
    </Shell>
  );
}
