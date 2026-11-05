import { parseDateInput } from "@/lib/utils";

/** Petits utilitaires de lecture de FormData typée. */
export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
};
export const reqStr = (fd: FormData, k: string) => str(fd, k) ?? "";
export const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
export const dec = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v == null) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const date = (fd: FormData, k: string) => parseDateInput(fd.get(k));
export const bool = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === "on" || v === "true" || v === "1";
};
export function oneOf<T extends string>(fd: FormData, k: string, values: readonly T[], fallback: T): T;
export function oneOf<T extends string>(fd: FormData, k: string, values: readonly T[]): T | null;
export function oneOf<T extends string>(fd: FormData, k: string, values: readonly T[], fallback?: T) {
  const v = str(fd, k);
  return v && (values as readonly string[]).includes(v) ? (v as T) : (fallback ?? null);
}
