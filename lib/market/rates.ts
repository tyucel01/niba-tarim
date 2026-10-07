export type CurrencyRates = { date: string; quotes: { code: string; name: string; buy: number; sell: number }[] };
export function parseTcmbRates(xml: string): CurrencyRates {
  const date = xml.match(/<Tarih_Date\b[^>]*\bTarih="(\d{2}\.\d{2}\.\d{4})"/)?.[1];
  if (!date) throw new Error('Kur tarihi bulunamadı.');
  const quotes = ['USD', 'EUR'].map(code => {
    const block = xml.match(new RegExp(`<Currency\\b[^>]*\\bKod="${code}"[^>]*>([\\s\\S]*?)<\\/Currency>`))?.[1] || '';
    const number = (tag: string) => Number(block.match(new RegExp(`<${tag}>\\s*([0-9.]+)\\s*<\\/${tag}>`))?.[1]);
    const buy = number('ForexBuying'), sell = number('ForexSelling'), unit = number('Unit');
    if (![buy, sell, unit].every(value => Number.isFinite(value) && value > 0)) throw new Error('Kur verisi geçersiz.');
    return { code, name: code === 'USD' ? 'Dolar' : 'Euro', buy: buy / unit, sell: sell / unit };
  });
  return { date, quotes };
}
