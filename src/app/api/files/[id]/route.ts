import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { getContext } from "@/server/context";
import { audit } from "@/server/audit";

/** Téléchargement sécurisé : déchiffrement à la volée + contrôle d'accès + traçabilité. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const doc = await db.document.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const allowed =
    ctx.can("document.read.all") ||
    (doc.employeeId && doc.employeeId === ctx.employeeId) ||
    (doc.assetId && ctx.can("asset.read"));
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const data = await getObject(doc.storageKey);
  await audit(ctx, "document.view", "document", doc.id, { title: doc.title });
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
