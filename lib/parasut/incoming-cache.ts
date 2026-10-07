import { invoiceAdmin } from './invoice-pool';
const inFlight = new Map<string, Promise<any>>();
const ttl = 5 * 60 * 1000;
export async function cachedIncomingPage(key: string, fetchPage: () => Promise<any>) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = load(key, fetchPage);
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}
async function load(key: string, fetchPage: () => Promise<any>) {
  const db = invoiceAdmin();
  const read = async () => {
    const {data,error} = await db.from('parasut_response_cache').select('payload,expires_at').eq('cache_key',key).maybeSingle();
    if (error) throw new Error('Fatura önbelleği okunamadı.');
    return data;
  };
  let cached = await read();
  if (cached?.payload && Date.parse(cached.expires_at) > Date.now()) return cached.payload;
  const {data:claimed,error} = await db.rpc('claim_parasut_cache',{p_key:key});
  if (error) throw new Error('Fatura önbelleği kontrol edilemedi.');
  if (!claimed) {
    if (cached?.payload) return cached.payload;
    for (let attempt=0;attempt<5;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,400));
      cached = await read();
      if (cached?.payload) return cached.payload;
    }
    throw new Error('Fatura listesi hazırlanıyor. Biraz sonra yenileyin.');
  }
  try {
    const payload = await fetchPage();
    const {error:writeError} = await db.from('parasut_response_cache').update({payload,expires_at:new Date(Date.now()+ttl).toISOString(),locked_until:new Date().toISOString()}).eq('cache_key',key);
    if (writeError) throw new Error('Fatura önbelleği kaydedilemedi.');
    return payload;
  } catch (cause) {
    // Cool down failed calls as well, rather than hitting Paraşüt repeatedly.
    await db.from('parasut_response_cache').update({locked_until:new Date(Date.now()+ttl).toISOString()}).eq('cache_key',key);
    throw cause;
  }
}
