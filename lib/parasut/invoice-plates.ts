export function invoicePlates(...texts: unknown[]): string[] {
  const result = new Set<string>();
  for (const text of texts) {
    if (typeof text !== 'string') continue;
    const normalized = text.toLocaleUpperCase('tr-TR');
    for (const match of normalized.matchAll(/\b(0[1-9]|[1-7]\d|8[01])[\s-]*([A-Z]{1,3})[\s-]*(\d{2,5})\b/g)) {
      if (['TON','KDV','TRY','KG'].includes(match[2])) continue;
      result.add(`${match[1]} ${match[2]} ${match[3]}`);
    }
  }
  return [...result];
}
