export type SalesSummaryRow = { satisTarihi?: unknown; teslimOlanTonaj?: unknown; sevkDurumu?: unknown; pesinSatisFiyati?: unknown };
type Metric = { value: number; previous: number; change: number | null; missingPrice: boolean; series: number[] };
export type SalesPeriod = { key: string; label: string; range: string; comparison: string; previousRecords: number; tons: Metric; count: Metric; amount: Metric; missingPrices: number };
export type SalesSummary = { today: string; periods: SalesPeriod[]; ignored: number };
export function istanbulDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)?.value).join('-');
}
const iso = (date: Date) => date.toISOString().slice(0, 10);
function validDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && iso(date) === value ? value : null;
  }
  return null;
}
function tonnage(value: unknown): number {
  let normalized = value;
  if (typeof value === 'string') normalized = value.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
function lastDay(year: number, month: number) { return new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); }
function nextDay(date: string) { return iso(new Date(Date.parse(date + 'T00:00:00Z') + 86400000)); }
function display(date: string) { return date.split('-').reverse().join('.'); }
export function buildSalesSummary(input: SalesSummaryRow[], today: string): SalesSummary {
  if (!validDate(today)) throw new Error('Geçersiz rapor tarihi.');
  const [year, monthNumber, day] = today.split('-').map(Number), month = monthNumber - 1;
  let ignored = 0;
  const rows = input.flatMap(row => {
    const date = validDate(row.satisTarihi);
    if (!date) { ignored++; return []; }
    if (date > today || String(row.sevkDurumu || '').toLowerCase().replace(/\u0307/g,'').replace(/ı/g,'i').includes('iptal')) return [];
    const tons = tonnage(row.teslimOlanTonaj), price = tonnage(row.pesinSatisFiyati);
    return [{ date, tons, amount: Math.round(tons * price * 100) / 100, missingPrice: tons > 0 && price <= 0 }];
  });
  const yesterday = iso(new Date(Date.UTC(year, month, day - 1)));
  const previousMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const py = previousMonthStart.getUTCFullYear(), pm = previousMonthStart.getUTCMonth();
  const previousMonthEnd = iso(new Date(Date.UTC(py, pm, Math.min(day, lastDay(py, pm)))));
  const previousYearEnd = iso(new Date(Date.UTC(year - 1, month, Math.min(day, lastDay(year - 1, month)))));
  const specs = [
    {key:'day',label:'Günlük',start:today,end:today,previousStart:yesterday,previousEnd:yesterday,comparison:'Düne göre',trendStart:iso(new Date(Date.UTC(year,month,day-6)))},
    {key:'month',label:'Aylık',start:iso(new Date(Date.UTC(year,month,1))),end:today,previousStart:iso(previousMonthStart),previousEnd:previousMonthEnd,comparison:'Geçen ayın aynı aralığına göre',trendStart:iso(new Date(Date.UTC(year,month,1)))},
    {key:'year',label:'Yıllık',start:`${year}-01-01`,end:today,previousStart:`${year-1}-01-01`,previousEnd:previousYearEnd,comparison:'Geçen yılın aynı aralığına göre',trendStart:`${year}-01-01`},
  ];
  const periods = specs.map(spec => {
    const current = rows.filter(r => r.date >= spec.start && r.date <= spec.end);
    const previous = rows.filter(r => r.date >= spec.previousStart && r.date <= spec.previousEnd);
    const buckets: {tons:number;count:number;amount:number}[]=[];
    for(let date = spec.trendStart; date <= today; date = nextDay(date)) {
      const index = spec.key === 'year' ? Number(date.slice(5,7))-1 : buckets.length;
      if (!buckets[index]) buckets[index]={tons:0,count:0,amount:0};
      const matches = rows.filter(r => r.date === date);
      buckets[index].tons += matches.reduce((sum,r)=>sum+r.tons,0); buckets[index].count += matches.length; buckets[index].amount += matches.reduce((sum,r)=>sum+r.amount,0);
    }
    function metric(key:'tons'|'count'|'amount'):Metric {
      const value = key === 'count' ? current.length : round(current.reduce((sum,r)=>sum+r[key],0));
      const prior = key === 'count' ? previous.length : round(previous.reduce((sum,r)=>sum+r[key],0));
      return {value,previous:prior,missingPrice:key === 'amount' && [...current,...previous].some(r=>r.missingPrice),change:prior>0 && previous.length>0 && (key !== 'amount' || ![...current,...previous].some(r=>r.missingPrice)) ? Math.round((value-prior)/prior*1000)/10 : null,series:buckets.map(bucket=>round(bucket[key]))};
    }
    return {key:spec.key,label:spec.label,range:spec.start===spec.end ? display(spec.start) : `${display(spec.start)} – ${display(spec.end)}`,comparison:spec.comparison,previousRecords:previous.length,tons:metric('tons'),count:metric('count'),amount:metric('amount'),missingPrices:current.filter(r=>r.missingPrice).length};
  });
  return {today,periods,ignored};
}
