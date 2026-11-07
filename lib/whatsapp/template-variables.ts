/** Preserve legacy body-only arrays; store both sections in the existing JSON field. */
export function encodeTemplateVariables(bodyVariables: string[], headerVariables: string[]) {
  return headerVariables.length ? { bodyVariables, headerVariables } : bodyVariables;
}

export function decodeTemplateVariables(value: unknown): { bodyVariables: string[]; headerVariables: string[] } {
  const strings = (items: unknown): string[] => Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : [];
  if (Array.isArray(value)) return { bodyVariables: strings(value), headerVariables: [] };
  const fields = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { bodyVariables: strings(fields.bodyVariables), headerVariables: strings(fields.headerVariables) };
}
