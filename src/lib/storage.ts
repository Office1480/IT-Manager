import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { decryptBuffer, encryptBuffer, sha256 } from "./crypto";

/**
 * Stockage local chiffré. L'interface est volontairement minimale
 * pour pouvoir brancher S3 / MinIO plus tard sans toucher au métier.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Clé de stockage invalide");
  return full;
}

export async function putObject(orgId: string, data: Buffer) {
  const key = `${orgId}/${new Date().getFullYear()}/${randomUUID()}.bin`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, encryptBuffer(data), { mode: 0o600 });
  return { key, sha256: sha256(data), size: data.length };
}

export async function getObject(key: string): Promise<Buffer> {
  return decryptBuffer(await readFile(resolveKey(key)));
}

export async function deleteObject(key: string) {
  await unlink(resolveKey(key)).catch(() => undefined);
}
