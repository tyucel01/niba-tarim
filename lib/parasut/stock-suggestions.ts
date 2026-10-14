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
  // Paraşüt's name filter is exact: query a bounded set of real name spellings.
  const grade = f.formula;
  const zinc = f.qualifiers.includes("zn") ? "ZN" : "";
  const terms = [value, grade.replace(/\./g, "-"), grade,
    zinc && `${grade} +${zinc}`, zinc && `${grade}+${zinc}`,
    zinc && `${grade.replace(/\./g, "-")} +${zinc}`]
    .filter((term): term is string => Boolean(term) && String(term).length >= 2);
  return [...new Set(terms)].slice(0, 6);
}
export function manualStockSearchTerms(query: string, sourceName: string) {
  const queryWords = productText(query).split(" ").filter(Boolean);
  const sourceWords = new Set(productText(sourceName).split(" "));
  const useSource = queryWords.length > 0 && queryWords.every(word => sourceWords.has(word));
  return [...new Set([...stockSearchTerms(query), ...(useSource ? stockSearchTerms(sourceName) : [])])].slice(0, 6);
}
export function stockMatchNote(source: unknown, target: unknown) {
  const a = features(source), b = features(target);
  if (a.formula && a.formula !== b.formula) return "Faturadaki ürün formülüyle eşleşmiyor; kontrol edin.";
  if (a.formula && a.qualifiers.join(" ") !== b.qualifiers.join(" ")) return `Formül aynı; katkı bilgilerini kontrol edin (fatura: ${a.qualifiers.join(", ") || "belirtilmemiş"}, stok: ${b.qualifiers.join(", ") || "belirtilmemiş"}).`;
  return "";
}
export function stockMatchScore(source: unknown, target: unknown) {
  const a = features(source), b = features(target);
  if (!a.text || !b.text || (a.formula && a.formula !== b.formula)) return 0;
  if (a.text === b.text) return 100;
  const qualifiersEqual = a.qualifiers.join(" ") === b.qualifiers.join(" ");
  if (!qualifiersEqual) {
    if (!a.formula || a.formula !== b.formula) return 0;
    const missing = a.qualifiers.filter(word => !b.qualifiers.includes(word));
    const extra = b.qualifiers.filter(word => !a.qualifiers.includes(word));
    // Zinc is a product distinction; missing SO3 on the stock label is a smaller uncertainty.
    return Math.max(10, 90 - missing.reduce((sum, word) => sum + (word === "zn" || word === "cinko" ? 45 : 10), 0) - extra.length * 20);
  }
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
  const candidates = unique.map(product => ({ id: String(product.id), name: String(product.attributes?.name || ""), code: product.attributes?.code || "", unit: product.attributes?.unit || "", inventoryTracking: Boolean(product.attributes?.inventory_tracking), matchNote: stockMatchNote(sourceName, product.attributes?.name), score: stockMatchScore(sourceName, product.attributes?.name) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "tr")).slice(0, 5);
  const first = candidates[0], second = candidates[1];
  const suggestedId = first && first.score >= 85 && (!second || first.score - second.score >= 12) && first.unit ? first.id : "";
  return { candidates, suggestedId };
}
