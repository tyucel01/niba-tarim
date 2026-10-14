import { cachedIncomingPage } from "./incoming-cache";
import { invoiceAdmin } from "./invoice-pool";
import { productText } from "./stock-suggestions";
const catalogKey = (companyId: string) => `stock-catalog:v1:${companyId}`;
export async function cachedStockSearch(companyId: string, term: string, get: (path: string) => Promise<any>) {
  // Cache the compact name index in the database for four hours, shared by all servers.
  // Browser requests receive matching candidates, never the complete stock catalog.
  const catalog = await cachedIncomingPage(catalogKey(companyId), async () => {
    const products: any[] = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const data = await get(`/products?page[size]=25&page[number]=${page}&sort=id`);
      pages = Number(data.meta?.total_pages || 1);
      if (!Number.isInteger(pages) || pages < 0 || pages > 200) throw new Error("Stok adları indeksi tamamlanamadı.");
      for (const item of data.data || []) products.push({ id: String(item.id), type: "products", attributes: { name: item.attributes?.name || "", code: item.attributes?.code || "", unit: item.attributes?.unit || "", archived: Boolean(item.attributes?.archived), inventory_tracking: Boolean(item.attributes?.inventory_tracking) } });
    }
    return { products };
  });
  const words = productText(term).split(" ").filter(Boolean);
  if (!words.length) return [];
  return catalog.products.filter((item: any) => {
    if (item.attributes?.archived) return false;
    const tokens = productText(`${item.attributes?.name || ""} ${item.attributes?.code || ""}`).split(" ");
    return words.every(word => tokens.some(token => token.includes(word)));
  });
}
export async function invalidateStockCatalog(companyId: string) {
  const { error } = await invoiceAdmin().from("parasut_response_cache").update({ expires_at: new Date(0).toISOString() }).eq("cache_key", catalogKey(companyId));
  if (error) throw new Error("Stok adları indeksi yenilenemedi.");
}
