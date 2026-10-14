// Share a small cache of exact-name queries across automatic and manual stock search.
// There is no unfiltered inventory request, and repeated invoice openings reuse results.
const queries = new Map<string, { expires: number; products: any[] }>();
const pending = new Map<string, Promise<any[]>>();
export async function cachedStockSearch(companyId: string, term: string, get: (path: string) => Promise<any>) {
  const key = `${companyId}:${term.toLocaleLowerCase("tr-TR")}`;
  const cached = queries.get(key);
  if (cached && cached.expires > Date.now()) return cached.products;
  if (pending.has(key)) return pending.get(key)!;
  const promise = get(`/products?page[size]=25&filter[name]=${encodeURIComponent(term)}`).then(data => {
    const products = data.data || [];
    if (queries.size >= 200) queries.delete(queries.keys().next().value!);
    queries.set(key, { expires: Date.now() + 5 * 60_000, products }); return products;
  }).finally(() => pending.delete(key));
  pending.set(key, promise); return promise;
}
