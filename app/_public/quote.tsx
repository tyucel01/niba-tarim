'use client';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import s from './site.module.css';

export default function Quote() {
  const [notice, setNotice] = useState('');
  return (
    <section className={s.quote} id="iletisim">
      <div className={`${s.container} ${s.quoteGrid}`}>
        <div>
          <span className={s.eyebrow}>İLETİŞİME GEÇİN</span>
          <h2>İhtiyacınızı paylaşın,<br />birlikte değerlendirelim.</h2>
          <p>Sorularınız ve teklif talepleriniz için bize ulaşın.</p>
          <a href="tel:+905334928522">0533 492 85 22 ↗</a>
        </div>
        <form className={s.form} onSubmit={event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = String(data.get('ad') || '').trim();
          const city = String(data.get('il') || '').trim();
          const phone = String(data.get('telefon') || '').trim();
          const message = String(data.get('mesaj') || '').trim();
          if (!name || !city || !phone || !message) {
            setNotice('Lütfen bütün alanları doldurun.');
            return;
          }
          const body = `Ad Soyad: ${name}\r\nİl: ${city}\r\nİletişim No: ${phone}\r\n\r\nMesaj:\r\n${message}`;
          window.location.assign('mailto:info@nibatarim.com?subject=' + encodeURIComponent('Niba Tarım iletişim talebi') + '&body=' + encodeURIComponent(body));
          setNotice('E-posta uygulamanızda açılan mesajı gönderin. Açılmazsa info@nibatarim.com adresine yazabilirsiniz.');
        }}>
          <label className={s.fullField}>Ad Soyad<input name="ad" autoComplete="name" placeholder="Adınız ve soyadınız" maxLength={100} required /></label>
          <label>İl<input name="il" autoComplete="address-level1" placeholder="Bulunduğunuz il" maxLength={80} required /></label>
          <label>İletişim No<input name="telefon" type="tel" autoComplete="tel" placeholder="05XX XXX XX XX" pattern="[0-9+() .-]{10,20}" maxLength={20} required /></label>
          <label className={s.fullField}>Mesaj<textarea name="mesaj" placeholder="Mesajınızı yazın" rows={4} maxLength={1500} required /></label>
          <button className={s.button} type="submit">Gönder<ArrowUpRight size={17} /></button>
          <small>E-posta uygulamanızda info@nibatarim.com adresine hazır mesaj açılır.</small>
          {notice && <p className={s.formNotice} role="status">{notice}</p>}
        </form>
      </div>
    </section>
  );
}
