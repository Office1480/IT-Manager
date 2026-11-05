import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AppContext } from "./context";

export async function audit(
  ctx: AppContext,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: {
      organizationId: ctx.orgId,
      actorId: ctx.userId,
      actorName: ctx.user.name,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata,
    },
  });
}
