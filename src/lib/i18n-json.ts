/** Lit un libellé multilingue stocké en JSON ({ fr, en, he }). */
export function lname(names: unknown, locale: string): string {
  if (!names || typeof names !== "object") return "";
  const n = names as Record<string, string>;
  return n[locale] ?? n.en ?? n.fr ?? Object.values(n)[0] ?? "";
}
