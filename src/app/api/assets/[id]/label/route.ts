import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getContext } from "@/server/context";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Étiquette imprimable (62 × 29 mm, format Brother/Dymo) avec QR code vers la fiche. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContext();
  if (!ctx || !ctx.can("asset.read")) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const a = await db.asset.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!a) return new NextResponse("Not found", { status: 404 });
  const origin = process.env.APP_URL ?? new URL(req.url).origin;
  const qr = await QRCode.toString(`${origin}/fr/assets/${a.id}`, { type: "svg", margin: 0 });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.assetTag)}</title>
<style>@page{size:62mm 29mm;margin:0}body{margin:0;font-family:system-ui,sans-serif}
.l{width:62mm;height:29mm;display:flex;align-items:center;gap:3mm;padding:2mm 3mm;box-sizing:border-box}
.q{width:24mm;height:24mm}.q svg{width:100%;height:100%}.t{font-weight:700;font-size:13pt;font-family:ui-monospace,monospace}
.s{font-size:7pt;color:#444;margin-top:1mm}.o{font-size:6pt;color:#888;margin-top:1.5mm;text-transform:uppercase;letter-spacing:.05em}</style></head>
<body onload="window.print()"><div class="l"><div class="q">${qr}</div><div><div class="t">${esc(a.assetTag)}</div>
<div class="s">${esc(a.brand)} ${esc(a.model)}</div><div class="s">S/N ${esc(a.serialNumber)}</div><div class="o">${esc(ctx.org.name)}</div></div></div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
