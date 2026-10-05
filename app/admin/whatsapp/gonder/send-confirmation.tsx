"use client";
import { useEffect, useRef } from "react";
import { ArrowLeft, Send, Users, X, CheckCircle2 } from "lucide-react";
import styles from "./send-confirmation.module.css";

type Props = {
  target: string; recipients: number | string; template: string; language: string;
  imageUrl: string; message: string; ready: boolean; sending: boolean;
  onCancel: () => void; onConfirm: () => void;
};
export function SendConfirmation(props: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);
  return <dialog ref={ref} className={styles.confirmDialog} aria-labelledby="send-confirmation-title" aria-describedby="send-confirmation-description" onCancel={event => { event.preventDefault(); if (!props.sending) props.onCancel(); }}>
    <header className={styles.confirmHeader}>
      <div><span className={styles.confirmEyebrow}>WHATSAPP GÖNDERİMİ</span><h2 id="send-confirmation-title">Her şey doğru mu?</h2><p id="send-confirmation-description">Alıcıları ve mesajını son kez kontrol et.</p></div>
      <button type="button" aria-label="Onayı kapat" disabled={props.sending} onClick={props.onCancel} className={styles.confirmClose}><X size={20} /></button>
    </header>
    <div className={styles.confirmBody}>
      <section className={styles.confirmTarget} aria-label="Gönderim hedefi">
        <div className={styles.confirmIcon}><Users size={22} /></div>
        <div><span>ALICI GRUBU / KİŞİ</span><h3>{props.target || "Alıcı seçilmedi"}</h3></div>
        <strong>{typeof props.recipients === "number" ? `${props.recipients} kişi` : "Grup üyeleri"}</strong>
      </section>
      <div className={styles.confirmTemplate}><span>Şablon</span><strong>{props.template || "Seçilmedi"}</strong><span>{props.language}</span></div>
      <p className={styles.confirmLabel}>ALICININ GÖRECEĞİ MESAJ</p>
      <section className={styles.confirmMessage} aria-label="Gönderilecek mesaj">
        <div className={styles.confirmBubble}>
          {props.imageUrl && <img src={props.imageUrl} alt="Gönderilecek fiyat listesi" />}
          <p>{props.message || props.template}</p>
          <span className={styles.confirmTime}>Şimdi ✓✓</span>
        </div>
      </section>
      <p className={styles.confirmNote}><CheckCircle2 size={17} /><span>Henüz gönderilmedi. Onayladığında mesaj, seçtiğin alıcılara ayrı ayrı gönderilmek üzere sıraya alınacak.</span></p>
    </div>
    <footer className={styles.confirmFooter}>
      <button type="button" disabled={props.sending} onClick={props.onCancel} className={styles.confirmBack}><ArrowLeft size={17} /> Düzenlemeye dön</button>
      <button type="button" disabled={props.sending || !props.ready} onClick={props.onConfirm} className={styles.confirmSend}><Send size={17} />{props.sending ? "Hazırlanıyor…" : "Onayla ve gönder"}</button>
    </footer>
  </dialog>;
}
