import { Shell, s, WhatsApp, Intro } from '../../_public/site';
export const metadata = {
  title: "Gübre Fiyatları 2026 | CAN 26, Üre, DAP Güncel Liste",
  description:
    "CAN 26, Üre, DAP ve kompoze gübre fiyatları hakkında güncel bilgiler. En iyi fiyat teklifini almak için hemen iletişime geçin.",
};

export default function Page() {
  return (
    <Shell><Intro label="Tarım rehberi" title="Gübre fiyatları ve teklif rehberi" text="Ürün, miktar ve teslimat koşullarını değerlendirerek tedarik ihtiyacınızı planlayın."/>

      <section className={`${s.container} ${s.section} ${s.article}`}>



        {/* HERO GÖRSEL */}
        <div className="mt-8 overflow-hidden rounded-3xl shadow-lg">
          <img
            src="/site/wheat-landscape.jpg"
            alt="Gelişim dönemindeki yeşil tahıl tarlası"
            className="w-full h-[420px] object-cover"
          />
        </div>

        <p className="mt-8 text-lg leading-8 text-slate-700">
          Gübre fiyatları 2026 yılında; döviz kuru, hammadde maliyetleri ve
          sezonluk talebe bağlı olarak değişiklik göstermektedir. CAN 26, Üre,
          DAP ve kompoze gübre gruplarında fiyatlar özellikle ekim dönemlerinde
          daha hızlı değişmektedir.
        </p>

        <h2 className="mt-12 text-2xl font-black text-emerald-900">
          Gübre fiyatları neden değişir?
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          Gübre fiyatlarını etkileyen en önemli faktörler arasında döviz kuru,
          uluslararası hammadde fiyatları, lojistik maliyetler ve arz-talep dengesi yer alır.
        </p>

        {/* ORTA GÖRSEL */}
        <div className="my-10">
          <img
            src="/site/corn-field.jpg"
            alt="Yeşil mısır tarlası"
            className="w-full h-[350px] object-cover rounded-2xl shadow-md"
          />
          <p className="text-sm text-slate-500 mt-2">
            Tarla görselleri temsilidir; ürün ve teslimat koşulları teklif sırasında değerlendirilir.
          </p>
        </div>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          CAN 26 gübre fiyatı
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          CAN 26 gübre, azotlu gübre grubunda en çok tercih edilen ürünlerden biridir.
          Fiyatı; sipariş miktarı, teslimat lokasyonu ve piyasa koşullarına göre değişiklik gösterir.
        </p>

        <div className="my-8">
          <img
            src="/site/canola-field.jpg"
            alt="Kanola tarlası"
            className="w-full h-[350px] object-cover rounded-2xl shadow-md"
          />
        </div>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          Üre gübre fiyatı
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          Üre gübre, yüksek azot içeriği ile verimi artırmak için tercih edilir.
          Fiyatlar global piyasa ve ithalat maliyetlerine göre değişir.
        </p>

        <div className="my-8">
          <img
            src="/site/wheat-landscape.jpg"
            alt="Gelişim dönemindeki yeşil tahıl tarlası"
            className="w-full h-[350px] object-cover rounded-2xl shadow-md"
          />
        </div>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          DAP ve kompoze gübre fiyatları
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          DAP ve kompoze gübreler özellikle ekim dönemlerinde yoğun talep görür.
          Bu nedenle fiyatlar sezonluk olarak değişiklik gösterir.
        </p>

        <div className="my-8">
          <img
            src="/site/corn-field.jpg"
            alt="Yeşil mısır tarlası"
            className="w-full h-[350px] object-cover rounded-2xl shadow-md"
          />
        </div>

        <h2 className="mt-10 text-2xl font-black text-emerald-900">
          Güncel gübre fiyatı nasıl alınır?
        </h2>

        <p className="mt-4 text-slate-700 leading-7">
          En doğru gübre fiyatını almak için ürün adı, miktar ve teslimat
          lokasyonu belirtilmelidir. Niba Tarım olarak hızlı ve avantajlı
          fiyat teklifleri sunuyoruz.
        </p>

        {/* CTA */}
        <div className={s.aside}><h3>Güncel teklif alın</h3><p>Ürün, tonaj ve teslimat ilinizi bize iletin.</p><WhatsApp/></div>

      </section>

    </Shell>
  );
}
