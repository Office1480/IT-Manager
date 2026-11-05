import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Les polices standard PDF ne couvrent que WinAnsi : on neutralise le reste. */
const safe = (s: string) => s.replace(/[^\x20-\x7E -ÿ’€]/g, "?").replace(/’/g, "'");

function wrap(text: string, font: PDFFont, size: number, max: number) {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export type HandoverPdfInput = {
  kind: "handover" | "return";
  labels: Record<string, string>;
  org: string;
  employee: string;
  asset: string;
  serial: string;
  tag: string;
  date: string;
  condition: string;
  liability?: string;
  terms: string;
  signerName: string;
  signaturePng?: string | null;
};

export async function buildHandoverPdf(i: HandoverPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(i.labels.title);
  pdf.setCreator("IT Manager");
  const page: PDFPage = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = rgb(0.357, 0.357, 0.839);
  const muted = rgb(0.45, 0.45, 0.5);
  const M = 56;
  let y = 790;

  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: accent });
  page.drawText(safe(i.org), { x: M, y: 822, size: 11, font: bold, color: rgb(1, 1, 1) });
  y -= 20;
  page.drawText(safe(i.labels.title), { x: M, y, size: 18, font: bold });
  y -= 36;

  const rows: [string, string][] = [
    [i.labels.employee, i.employee],
    [i.labels.asset, i.asset],
    [i.labels.serial, i.serial],
    [i.labels.tag, i.tag],
    [i.labels.date, i.date],
    [i.labels.condition, i.condition],
  ];
  if (i.liability) rows.push([i.labels.liability, i.liability]);
  for (const [k, v] of rows) {
    page.drawText(safe(k), { x: M, y, size: 10, font, color: muted });
    page.drawText(safe(v), { x: M + 150, y, size: 11, font: bold });
    y -= 22;
    page.drawLine({ start: { x: M, y: y + 14 }, end: { x: 595 - M, y: y + 14 }, thickness: 0.4, color: rgb(0.88, 0.88, 0.9) });
  }
  y -= 16;
  for (const line of wrap(i.terms, font, 11, 595 - M * 2)) {
    page.drawText(line, { x: M, y, size: 11, font, lineHeight: 15 });
    y -= 16;
  }
  y -= 30;
  page.drawText(safe(i.labels.signature), { x: M, y, size: 10, font, color: muted });
  y -= 10;
  page.drawRectangle({ x: M, y: y - 110, width: 260, height: 110, borderColor: rgb(0.85, 0.85, 0.88), borderWidth: 1 });
  if (i.signaturePng?.startsWith("data:image/png;base64,")) {
    const img = await pdf.embedPng(Buffer.from(i.signaturePng.split(",")[1], "base64"));
    const scale = Math.min(250 / img.width, 100 / img.height);
    page.drawImage(img, { x: M + 5, y: y - 105, width: img.width * scale, height: img.height * scale });
  }
  page.drawText(safe(i.signerName), { x: M, y: y - 128, size: 11, font: bold });
  page.drawText(safe(`${i.labels.generated} - ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`), { x: M, y: 40, size: 8, font, color: muted });
  return Buffer.from(await pdf.save());
}
