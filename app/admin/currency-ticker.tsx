"use client";
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { CurrencyRates } from '@/lib/market/rates';
import styles from './currency-ticker.module.css';
export default function CurrencyTicker() {
  const [rates, setRates] = useState<CurrencyRates | null>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || document.visibilityState !== 'visible') return;
      busy = true;
      try {
        const response = await fetch('/api/market/rates', { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error();
        if (!controller.signal.aborted) { setRates(data); setFailed(false); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      finally { busy = false; }
    }
    void load();
    const timer = setInterval(load, 60 * 60 * 1000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  const format = (value: number) => new Intl.NumberFormat('tr-TR', {minimumFractionDigits: 4, maximumFractionDigits: 4}).format(value);
  const text = rates ? rates.quotes.map(q => `${q.name}: alış ${format(q.buy)} TL, satış ${format(q.sell)} TL`).join('. ') : '';
  return <section className={styles.ticker} aria-label="Dolar ve Euro kurları">
    <span className={styles.label}><i aria-hidden="true" />DÖVİZ</span>
    {rates ? <><p className="sr-only">TCMB gösterge kurları. {rates.date}. {text}{failed ? '. Son alınan kurlar gösteriliyor.' : ''}</p>
      <div className={styles.viewport} aria-hidden="true"><div className={`${styles.track} ${paused ? styles.paused : ''}`}>{[0,1,2].map(copy => <div className={styles.group} key={copy}>{rates.quotes.map(q => <span className={styles.quote} key={q.code}><b>{q.code}/TRY</b><span>Alış <strong>₺{format(q.buy)}</strong></span><span>Satış <strong>₺{format(q.sell)}</strong></span><i>•</i></span>)}</div>)}</div></div>
      <a className={styles.source} href="https://www.tcmb.gov.tr/kurlar/today.xml" target="_blank" rel="noopener noreferrer" title={`TCMB gösterge kurları · ${rates.date}${failed ? ' · Son alınan veriler' : ''}`}>TCMB · {rates.date}{failed ? ' · Son veri' : ''}</a>
      <button className={styles.pause} type="button" onClick={()=>setPaused(!paused)} aria-label={paused ? 'Kur şeridini oynat' : 'Kur şeridini duraklat'} aria-pressed={paused}>{paused ? <Play size={13}/> : <Pause size={13}/>}</button>
    </> : <p className={styles.status} role="status">{failed ? 'Döviz kurları şu anda alınamıyor.' : 'Döviz kurları yükleniyor…'}</p>}
  </section>;
}
