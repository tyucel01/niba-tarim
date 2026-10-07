import { Shell, Intro, s, Photo, Benefits, WhatsApp } from '../_public/site';
import Quote from '../_public/quote';

export const metadata = {
  title: 'Hakkımızda | Niba Tarım',
  description: '80 yılı aşkın tarım ticareti, zahirecilik ve gübre ticareti deneyiminden beslenen Niba Tarım’ın çalışma anlayışını tanıyın.',
};

export default function About() {
  return (
    <Shell>
      <Intro label="Hakkımızda" title="Köklü deneyim, güvene dayalı ticaret." text="80 yılı aşkın tarım ticareti, zahirecilik ve gübre ticareti deneyiminden aldığımız birikimle, iş ortaklarımızın yanında yer alıyoruz." />
      <section className={s.section}>
        <div className={`${s.container} ${s.contactGrid}`}>
          <div className={s.articleImage}><Photo src="/site/corn-field.jpg" alt="Gelişim dönemindeki yeşil mısır tarlası" /></div>
          <div>
            <span className={s.eyebrow}>NİBA TARIM</span>
            <h2>Deneyimimiz köklü,<br />sözümüz net.</h2>
            <p>Niba Tarım’ın çalışma anlayışının temelinde, 80 yılı aşkın tarım ticareti, zahirecilik ve gübre ticareti deneyimi yer alır. Tahıl ve yağlı tohumların ticaretinden gübre tedariğine uzanan bu birikim, tarımın mevsimlerini, ürünün değerini ve zamanında tedariğin önemini bilmemizi sağlar.</p>
            <p>Bizim için güven, işin her aşamasında gösterilen özenle kazanılır. Ürün niteliğini, fiyatı ve teslimat koşullarını açıkça konuşmayı; verdiğimiz sözün arkasında durmayı ve iş ortaklarımızla uzun vadeli ilişkiler kurmayı esas alırız.</p>
            <WhatsApp />
          </div>
        </div>
      </section>
      <div className={s.container}><Benefits /></div>
      <section className={s.section}>
        <div className={s.container}>
          <h2>Her alışverişte aynı özen.</h2>
          <p>Üreticilerin, bayilerin ve tarımsal işletmelerin ihtiyaçlarını dikkatle dinler; ürün, miktar ve teslimat planını birlikte değerlendiririz. Kaliteli ürünü uygun koşullarda sunmak, tedarik sürecini özenle takip etmek ve ihtiyaç duyulduğunda ulaşılabilir olmak çalışma anlayışımızın parçasıdır.</p>
          <p>Köklü ticaret deneyimimizi günümüzün ihtiyaçlarıyla birleştirirken ölçümüz değişmez: dürüst iletişim, karşılıklı güven ve sürdürülebilir iş birliği. Niba Tarım olarak her alışverişi, birlikte çalışmanın sorumluluğuyla ele alırız.</p>
          <strong>Gübrede Kalite, Alışverişte Güven!</strong>
        </div>
      </section>
      <Quote />
    </Shell>
  );
}
