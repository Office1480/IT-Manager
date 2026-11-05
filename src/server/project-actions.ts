"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { BacklogStage } from "@prisma/client";
import { db } from "@/lib/db";
import { requireContext } from "./context";
import { audit } from "./audit";
import { dec, int, oneOf, reqStr, str } from "./form";
import { canManageProject } from "./projects";
import { createJiraIssue, jiraConfigured } from "./jira";
import type { ActionResult } from "./action-result";

const STATUSES = ["ACTIVE", "BUILD", "MAINTENANCE", "SUNSET"] as const;
const CRITS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STAGES = ["IDEA", "SCOPING", "DEFINITION", "REVIEW", "VALIDATED", "IN_JIRA", "REJECTED"] as const;
const GATED: BacklogStage[] = ["VALIDATED", "IN_JIRA", "REJECTED"];
const refresh = () => revalidatePath("/[locale]/(app)", "layout");

function parseLinks(raw: string | null) {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, b] = l.split("|").map((x) => x.trim());
      const url = b ?? a;
      return /^https?:\/\//.test(url) ? { label: b ? a : url.replace(/^https?:\/\//, ""), url } : null;
    })
    .filter(Boolean) as { label: string; url: string }[];
}

function readProject(fd: FormData) {
  const lvl = (k: string, d: number) => Math.min(5, Math.max(1, int(fd, k) ?? d));
  return {
    key: reqStr(fd, "key").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
    name: reqStr(fd, "name"),
    tagline: str(fd, "tagline"),
    definition: str(fd, "definition"),
    status: oneOf(fd, "status", STATUSES, "ACTIVE"),
    criticality: oneOf(fd, "criticality", CRITS, "MEDIUM"),
    color: /^#[0-9a-f]{6}$/i.test(str(fd, "color") ?? "") ? str(fd, "color")! : "#6366f1",
    ownerId: str(fd, "ownerId"),
    ownerExpertise: lvl("ownerExpertise", 5),
    deputyId: str(fd, "deputyId"),
    deputyExpertise: lvl("deputyExpertise", 3),
    links: parseLinks(str(fd, "links")),
    jiraProjectKey: str(fd, "jiraProjectKey")?.toUpperCase() ?? null,
  };
}

async function validateProject(orgId: string, d: ReturnType<typeof readProject>, excludeId?: string) {
  const t = await getTranslations();
  const e: Record<string, string> = {};
  if (!d.name) e.name = t("common.required");
  if (!d.key) e.key = t("common.required");
  if (d.ownerId && d.ownerId === d.deputyId) e.deputyId = t("projects.sameOwnerDeputy");
  if (d.key && (await db.project.findFirst({ where: { organizationId: orgId, key: d.key, id: excludeId ? { not: excludeId } : undefined } }))) e.key = t("projects.keyTaken");
  for (const id of [d.ownerId, d.deputyId]) if (id && !(await db.employee.findFirst({ where: { id, organizationId: orgId } }))) e.ownerId = t("common.error");
  return e;
}

export async function saveProjectAction(id: string | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext();
  const existing = id ? await db.project.findFirst({ where: { id, organizationId: ctx.orgId } }) : null;
  if (id && !existing) return { ok: false, error: "notFound" };
  if (existing ? !canManageProject(ctx, existing) : !ctx.can("project.write")) return { ok: false, error: "forbidden" };
  const data = readProject(fd);
  const errors = await validateProject(ctx.orgId, data, id ?? undefined);
  if (Object.keys(errors).length) return { ok: false, error: "validation", fieldErrors: errors };
  const p = existing
    ? await db.project.update({ where: { id: existing.id }, data })
    : await db.project.create({ data: { ...data, organizationId: ctx.orgId } });
  await audit(ctx, existing ? "project.update" : "project.create", "project", p.id, { name: p.name, owner: data.ownerId, deputy: data.deputyId });
  refresh();
  return { ok: true, data: { id: p.id } };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("project.write");
  const res = await db.project.deleteMany({ where: { id, organizationId: ctx.orgId } });
  if (!res.count) return { ok: false, error: "notFound" };
  await audit(ctx, "project.delete", "project", id);
  refresh();
  return { ok: true };
}

// ── Backlog ─────────────────────────────────────────────────

export async function saveBacklogItemAction(itemId: string | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireContext("backlog.write");
  const projectId = str(fd, "projectId");
  const project = projectId ? await db.project.findFirst({ where: { id: projectId, organizationId: ctx.orgId } }) : null;
  const item = itemId ? await db.backlogItem.findFirst({ where: { id: itemId, organizationId: ctx.orgId }, include: { project: true } }) : null;
  const target = item?.project ?? project;
  if (!target) return { ok: false, error: "notFound" };
  const title = reqStr(fd, "title");
  if (!title) return { ok: false, error: "validation", fieldErrors: { title: (await getTranslations("common"))("required") } };
  const isAuthor = item?.authorId && item.authorId === ctx.employeeId;
  if (item && !isAuthor && !canManageProject(ctx, item.project)) return { ok: false, error: "forbidden" };
  const data = {
    title,
    problem: str(fd, "problem"),
    proposal: str(fd, "proposal"),
    acceptance: str(fd, "acceptance"),
    reach: int(fd, "reach"),
    impact: dec(fd, "impact"),
    confidence: (() => { const c = int(fd, "confidence"); return c == null ? null : Math.min(100, Math.max(0, c)); })(),
    effort: dec(fd, "effort"),
  };
  let saved;
  if (item) saved = await db.backlogItem.update({ where: { id: item.id }, data });
  else {
    const last = await db.backlogItem.aggregate({ where: { projectId: target.id }, _max: { number: true } });
    saved = await db.backlogItem.create({
      data: { ...data, organizationId: ctx.orgId, projectId: target.id, number: (last._max.number ?? 0) + 1, authorId: ctx.employeeId, position: -Date.now() / 1e6 },
    });
  }
  await audit(ctx, item ? "backlog.update" : "backlog.create", "backlog", saved.id, { title });
  refresh();
  return { ok: true, data: { id: saved.id } };
}

export async function moveBacklogItemAction(id: string, stage: BacklogStage, position?: number): Promise<ActionResult> {
  const ctx = await requireContext("backlog.write");
  if (!STAGES.includes(stage)) return { ok: false, error: "invalid" };
  const item = await db.backlogItem.findFirst({ where: { id, organizationId: ctx.orgId }, include: { project: true } });
  if (!item) return { ok: false, error: "notFound" };
  const manage = canManageProject(ctx, item.project);
  const isAuthor = item.authorId === ctx.employeeId;
  if ((GATED.includes(stage) || GATED.includes(item.stage)) && !manage) return { ok: false, error: "forbidden" };
  if (!manage && !isAuthor) return { ok: false, error: "forbidden" };
  await db.backlogItem.update({
    where: { id },
    data: { stage, ...(position != null ? { position } : {}), ...(stage !== item.stage ? { stageChangedAt: new Date() } : {}) },
  });
  if (stage !== item.stage) await audit(ctx, "backlog.move", "backlog", id, { from: item.stage, to: stage });
  refresh();
  return { ok: true };
}

export async function deleteBacklogItemAction(id: string): Promise<ActionResult> {
  const ctx = await requireContext("backlog.write");
  const item = await db.backlogItem.findFirst({ where: { id, organizationId: ctx.orgId }, include: { project: true } });
  if (!item || (!canManageProject(ctx, item.project) && item.authorId !== ctx.employeeId)) return { ok: false, error: "forbidden" };
  await db.backlogItem.delete({ where: { id } });
  refresh();
  return { ok: true };
}

export async function addCommentAction(itemId: string, body: string): Promise<ActionResult> {
  const ctx = await requireContext("backlog.write");
  const item = await db.backlogItem.findFirst({ where: { id: itemId, organizationId: ctx.orgId } });
  if (!item || !body.trim()) return { ok: false, error: "invalid" };
  await db.backlogComment.create({ data: { organizationId: ctx.orgId, itemId, authorId: ctx.employeeId, authorName: ctx.user.name, body: body.trim().slice(0, 5000) } });
  refresh();
  return { ok: true };
}

export async function sendToJiraAction(itemId: string, manualKey?: string): Promise<ActionResult<{ key: string; url: string | null }>> {
  const ctx = await requireContext("backlog.write");
  const item = await db.backlogItem.findFirst({ where: { id: itemId, organizationId: ctx.orgId }, include: { project: true } });
  if (!item) return { ok: false, error: "notFound" };
  if (!canManageProject(ctx, item.project)) return { ok: false, error: "forbidden" };
  if (item.stage !== "VALIDATED") return { ok: false, error: "notValidated" };
  let key: string;
  let url: string | null = null;
  if (manualKey?.trim()) {
    key = manualKey.trim().toUpperCase();
    url = ctx.org.jiraBaseUrl ? `${ctx.org.jiraBaseUrl.replace(/\/+$/, "")}/browse/${key}` : null;
  } else {
    if (!jiraConfigured(ctx.org)) return { ok: false, error: "JIRA_NOT_CONFIGURED" };
    const t = await getTranslations("backlog");
    try {
      const res = await createJiraIssue(ctx.org, {
        projectKey: item.project.jiraProjectKey,
        summary: `[${item.project.key}-${item.number}] ${item.title}`,
        sections: [
          { title: t("problem"), body: item.problem },
          { title: t("proposal"), body: item.proposal },
          { title: t("acceptance"), body: item.acceptance },
        ],
        labels: ["it-manager", item.project.key.toLowerCase()],
      });
      key = res.key;
      url = res.url;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "JIRA_ERROR" };
    }
  }
  await db.backlogItem.update({ where: { id: itemId }, data: { stage: "IN_JIRA", jiraKey: key, jiraUrl: url, stageChangedAt: new Date() } });
  await audit(ctx, "backlog.jira", "backlog", itemId, { key });
  refresh();
  return { ok: true, data: { key, url } };
}

export async function loadBacklogItemAction(id: string) {
  const ctx = await requireContext("project.read");
  const { getBacklogItem } = await import("./projects");
  const item = await getBacklogItem(ctx, id);
  if (!item) return null;
  return {
    ...item,
    impact: item.impact == null ? null : Number(item.impact),
    effort: item.effort == null ? null : Number(item.effort),
    canManage: canManageProject(ctx, item.project),
    isAuthor: !!ctx.employeeId && item.authorId === ctx.employeeId,
    jiraConfigured: jiraConfigured(ctx.org),
  };
}
