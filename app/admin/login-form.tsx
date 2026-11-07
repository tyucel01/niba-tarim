'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import s from './login-form.module.css';

type Props = {
  step: 'login';
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
} | {
  step: 'otp';
  code: string;
  onCodeChange: (value: string) => void;
};

export default function LoginForm(props: Props & { onSubmit: () => Promise<string | void> }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const verifying = props.step === 'otp';
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
          <span className={s.eyebrow}>{verifying ? 'GÜVENLİ GİRİŞ' : 'HOŞ GELDİNİZ'}</span>
          <h2>{verifying ? 'SMS doğrulaması' : 'Yönetim paneline giriş'}</h2>
          <p className={s.description}>{verifying ? 'Girişi tamamlamak için telefonunuza gönderilen doğrulama kodunu girin.' : 'Devam etmek için e-posta adresinizi ve şifrenizi girin.'}</p>
          <form onSubmit={async event => {
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            setError('');
            try { setError(await props.onSubmit() || ''); }
            catch { setError(verifying ? 'Kod doğrulanamadı. Lütfen tekrar deneyin.' : 'Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.'); }
            finally { setBusy(false); }
          }}>
            {props.step === 'otp' ? (
              <>
                <label htmlFor="admin-otp">Doğrulama kodu</label>
                <div className={s.inputWrap}>
                  <LockKeyhole size={19} aria-hidden="true" />
                  <input id="admin-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]+" placeholder="SMS kodunuz" value={props.code} onChange={event => props.onCodeChange(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'admin-login-error' : undefined} required disabled={busy} />
                </div>
              </>
            ) : (
              <>
                <label htmlFor="admin-email">E-posta adresi</label>
                <div className={s.inputWrap}><Mail size={19} aria-hidden="true" /><input id="admin-email" type="email" autoComplete="username" placeholder="E-posta adresiniz" value={props.email} onChange={event => props.onEmailChange(event.target.value)} required disabled={busy} /></div>
                <label htmlFor="admin-password">Şifre</label>
                <div className={s.inputWrap}><LockKeyhole size={19} aria-hidden="true" /><input id="admin-password" type={visible ? 'text' : 'password'} autoComplete="current-password" placeholder="Şifreniz" value={props.password} onChange={event => props.onPasswordChange(event.target.value)} required disabled={busy} /><button className={s.eye} type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'} aria-pressed={visible}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
              </>
            )}
            {error && <p className={s.error} id="admin-login-error" role="alert">{error}</p>}
            <button className={s.submit} type="submit" disabled={busy}>
              {busy ? (verifying ? 'Doğrulanıyor…' : 'Giriş yapılıyor…') : (verifying ? 'Kodu doğrula' : 'Giriş yap')}
              <ArrowRight size={19} aria-hidden="true" />
            </button>
          </form>
          <div className={s.security}><ShieldCheck size={19} aria-hidden="true" /><span>{verifying ? 'Doğrulama kodunuzu kimseyle paylaşmayın.' : 'Girişiniz SMS doğrulamasıyla tamamlanır.'}</span></div>
        </div>
        <p className={s.footer}>© {new Date().getFullYear()} Niba Tarım</p>
      </section>
    </main>
  );
}
