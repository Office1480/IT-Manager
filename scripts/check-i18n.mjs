// Vérifie que fr / en / he ont exactement les mêmes clés.
import { readFileSync } from "node:fs";
const load = (l) => JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), "utf8"));
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const ref = new Set(flat(load("fr")));
let ok = true;
for (const l of ["en", "he"]) {
  const keys = new Set(flat(load(l)));
  for (const k of ref) if (!keys.has(k)) { console.error(`[${l}] manquant : ${k}`); ok = false; }
  for (const k of keys) if (!ref.has(k)) { console.error(`[${l}] en trop : ${k}`); ok = false; }
}
if (!ok) process.exit(1);
console.log(`i18n OK — ${ref.size} clés × 3 langues`);
