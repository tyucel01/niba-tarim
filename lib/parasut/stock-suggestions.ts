export function productText(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function features(value: unknown) {
  const raw = String(value ?? "");
  const formula = raw.match(/\b(\d{1,2})\s*([.\-/])\s*(\d{1,2})\s*\2\s*(\d{1,2})\b/) || raw.match(/\b(\d{1,2})\s*([.\-/])\s*(\d{1,2})\b/);
  const text = productText(raw);
  const ignored = new Set(["gubre", "gubresi", "urun", "kg", "ton", "adet", "kilo", "kilogram", "cuval", "torba"]);
  const words = [...new Set(text.split(" ").filter(word => word && !ignored.has(word) && !/^\d+$/.test(word)))];
  const qualifiers = words.filter(word => ["zn", "cinko", "bor", "b", "mg", "magnezyum", "so3", "kukurt"].includes(word)).sort();
  return { text, words, formula: formula ? [formula[1], formula[3], formula[4]].filter(value => value !== undefined).map(Number).join(".") : "", qualifiers };
}
export function stockSearchTerms(name: unknown) {
  const value = String(name ?? "").trim();
  const f = features(value);
  // Two short, filtered searches at most; never request an unfiltered stock list.
  const terms = [value, f.formula || f.words.slice(0, 2).join(" ")].filter(term => term.length >= 2);
  return [...new Set(terms)].slice(0, 2);
}
export function stockMatchScore(source: unknown, target: unknown) {
  const a = features(source), b = features(target);
  if (!a.text || !b.text || (a.formula && a.formula !== b.formula)) return 0;
  if (a.text === b.text) return 100;
  const qualifiersEqual = a.qualifiers.join(" ") === b.qualifiers.join(" ");
  if (!qualifiersEqual) return a.formula && a.formula === b.formula ? 35 : 0;
  const overlap = a.words.filter(word => b.words.includes(word)).length;
  if (a.formula && a.formula === b.formula) {
    const missing = a.words.filter(word => !b.words.includes(word)).length;
    const extras = b.words.filter(word => !a.words.includes(word)).length;
    return Math.max(45, 95 - missing * 15 - extras * 8);
  }
  if (!a.words.length || !b.words.length || !overlap) return 0;
  return Math.round(90 * overlap / Math.max(a.words.length, b.words.length));
}
export function rankStockCandidates(sourceName: string, products: any[]) {
  const unique = [...new Map(products.filter(product => product?.id && !product.attributes?.archived).map(product => [String(product.id), product])).values()];
  const candidates = unique.map(product => ({ id: String(product.id), name: String(product.attributes?.name || ""), code: product.attributes?.code || "", unit: product.attributes?.unit || "", inventoryTracking: Boolean(product.attributes?.inventory_tracking), score: stockMatchScore(sourceName, product.attributes?.name) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "tr")).slice(0, 5);
  const first = candidates[0], second = candidates[1];
  const suggestedId = first && first.score >= 85 && (!second || first.score - second.score >= 12) && first.unit ? first.id : "";
  return { candidates, suggestedId };
}
