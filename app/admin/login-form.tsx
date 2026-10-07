'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import s from './login-form.module.css';

type Props = {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => Promise<void>;
};

export default function LoginForm({ email, password, onEmailChange, onPasswordChange, onLogin }: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className={s.page}>
      <section className={s.brand} aria-label="Niba Tarım">
        <Link href="/" className={s.brandLogo}><Image src="/niba-logo-white.png" alt="Niba Tarım ana sayfa" width={180} height={110} /></Link>
        <div className={s.brandCopy}><span>NİBA TARIM · YÖNETİM PANELİ</span><h1>Gübrede Kalite,<br />Alışverişte Güven!</h1><p>Köklü ticaret deneyimi.<br />Güçlü iş birlikleri.</p></div>
        <div className={s.brandPhoto}><Image src="/site/fertilizer-urea-bags.jpg" alt="Gübre çuvalları ve bigbagler" fill sizes="(max-width: 760px) 0px, 50vw" /></div>
      </section>
      <section className={s.panel}>
        <Link href="/" className={s.back}>← Ana sayfaya dön</Link>
        <div className={s.formWrap}>
          <Image className={s.mobileLogo} src="/niba-logo-horizontal.png" alt="Niba Tarım" width={140} height={85} />
          <span className={s.eyebrow}>HOŞ GELDİNİZ</span>
          <h2>Yönetim paneline giriş</h2>
          <p className={s.description}>Devam etmek için e-posta adresinizi ve şifrenizi girin.</p>
          <form onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try { await onLogin(); }
            catch { setError('Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.'); }
            finally { setBusy(false); }
          }}>
            <label htmlFor="admin-email">E-posta adresi</label>
            <div className={s.inputWrap}><Mail size={19} aria-hidden="true" /><input id="admin-email" type="email" autoComplete="username" placeholder="E-posta adresiniz" value={email} onChange={event => onEmailChange(event.target.value)} required disabled={busy} /></div>
            <label htmlFor="admin-password">Şifre</label>
            <div className={s.inputWrap}><LockKeyhole size={19} aria-hidden="true" /><input id="admin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Şifreniz" value={password} onChange={event => onPasswordChange(event.target.value)} required disabled={busy} /><button className={s.eye} type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
            {error && <p className={s.error} role="alert">{error}</p>}
            <button className={s.submit} type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}<ArrowRight size={19} aria-hidden="true" /></button>
          </form>
          <div className={s.security}><ShieldCheck size={19} aria-hidden="true" /><span>Girişiniz SMS doğrulamasıyla tamamlanır.</span></div>
        </div>
        <p className={s.footer}>© {new Date().getFullYear()} Niba Tarım</p>
      </section>
    </main>
  );
}
