"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ExternalLink, Lightbulb, Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { BacklogStage } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { addCommentAction, deleteBacklogItemAction, loadBacklogItemAction, moveBacklogItemAction, saveBacklogItemAction, sendToJiraAction } from "@/server/project-actions";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const FLOW: BacklogStage[] = ["IDEA", "SCOPING", "DEFINITION", "REVIEW", "VALIDATED", "IN_JIRA"];
const GATED: BacklogStage[] = ["VALIDATED", "IN_JIRA", "REJECTED"];
const STAGE_COLOR: Record<BacklogStage, string> = { IDEA: "#a1a1aa", SCOPING: "#0ea5e9", DEFINITION: "#6366f1", REVIEW: "#f59e0b", VALIDATED: "#10b981", IN_JIRA: "#2684ff", REJECTED: "#ef4444" };

export type KanbanItem = {
  id: string; number: number; title: string; stage: BacklogStage; position: number; rice: number | null; comments: number; jiraKey: string | null; jiraUrl: string | null;
  author: { id: string; firstName: string; lastName: string } | null;
  project: { id: string; name: string; key: string; color: string };
  canManage: boolean; isAuthor: boolean;
};

type Loaded = NonNullable<Awaited<ReturnType<typeof loadBacklogItemAction>>>;

function ItemForm({ item, projects, defaultProjectId, onDone }: { item?: Loaded; projects?: { id: string; name: string }[]; defaultProjectId?: string; onDone: () => void }) {
  const t = useTranslations("backlog");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const editable = !item || item.canManage || item.isAuthor;
  return (
    <form
      className="grid grid-cols-1 gap-4 sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await saveBacklogItemAction(item?.id ?? null, fd);
          if (!res.ok) return void toast.error(tc("error"));
          toast.success(item ? tc("saved") : tc("created"));
          router.refresh();
          onDone();
        });
      }}
    >
      {!item && projects && (
        <Field label={t("project")} className="sm:col-span-4">
          <Select name="projectId" defaultValue={defaultProjectId}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </Field>
      )}
      {!item && !projects && <input type="hidden" name="projectId" value={defaultProjectId} />}
      <Field label={t("title")} required className="sm:col-span-4"><Input name="title" defaultValue={item?.title} required autoFocus={!item} disabled={!editable} /></Field>
      <Field label={t("problem")} className="sm:col-span-4"><Textarea name="problem" defaultValue={item?.problem ?? ""} rows={3} disabled={!editable} /></Field>
      <Field label={t("proposal")} className="sm:col-span-4"><Textarea name="proposal" defaultValue={item?.proposal ?? ""} rows={3} disabled={!editable} /></Field>
      <Field label={t("acceptance")} className="sm:col-span-4"><Textarea name="acceptance" defaultValue={item?.acceptance ?? ""} rows={3} disabled={!editable} /></Field>
      <Field label={t("reach")}><Input name="reach" type="number" min={0} defaultValue={item?.reach ?? ""} disabled={!editable} /></Field>
      <Field label={t("impact")}>
        <Select name="impact" defaultValue={item?.impact != null ? String(item.impact) : ""} disabled={!editable}>
          <option value="">—</option>{["0.25", "0.5", "1", "2", "3"].map((v) => <option key={v} value={v}>{v}</option>)}
        </Select>
      </Field>
      <Field label={t("confidence")}><Input name="confidence" type="number" min={0} max={100} step={10} defaultValue={item?.confidence ?? ""} disabled={!editable} /></Field>
      <Field label={t("effort")}><Input name="effort" type="number" min={0} step="0.5" defaultValue={item?.effort ?? ""} disabled={!editable} /></Field>
      {editable && (
        <div className="flex justify-end gap-2 sm:col-span-4">
          <Button type="submit" variant="primary" disabled={pending}>{pending && <Loader2 className="animate-spin" />}{tc("save")}</Button>
        </div>
      )}
    </form>
  );
}

function ItemDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("backlog");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [item, setItem] = useState<Loaded | null>(null);
  const [comment, setComment] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [pending, start] = useTransition();
  const reload = (iid: string) => loadBacklogItemAction(iid).then(setItem);
  useEffect(() => { setItem(null); if (id) reload(id); }, [id]);

  const move = (stage: BacklogStage) =>
    start(async () => {
      const r = await moveBacklogItemAction(item!.id, stage);
      if (!r.ok) return void toast.error(r.error === "forbidden" ? t("onlyOwner") : tc("error"));
      router.refresh();
      reload(item!.id);
    });

  const idx = item ? FLOW.indexOf(item.stage) : -1;
  const next = idx >= 0 && idx < FLOW.length - 2 ? FLOW[idx + 1] : null;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={item ? `${item.project.key}-${item.number} · ${item.title}` : "…"} description={item?.author ? t("author", { name: `${item.author.firstName} ${item.author.lastName}` }) : undefined} wide>
        {!item ? (
          <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-fg-subtle" /></div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-1">
              {FLOW.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <button
                    disabled={pending || s === "IN_JIRA" || (!item.canManage && (GATED.includes(s) || !item.isAuthor))}
                    onClick={() => move(s)}
                    className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed", item.stage === s ? "text-white" : i < idx ? "bg-bg-subtle text-fg-muted" : "border border-border text-fg-subtle hover:border-border-strong")}
                    style={item.stage === s ? { background: STAGE_COLOR[s] } : undefined}
                    title={t(`stageHint.${s}`)}
                  >{t(`stage.${s}`)}</button>
                  {i < FLOW.length - 1 && <ArrowRight className="size-3 text-fg-subtle rtl:rotate-180" />}
                </div>
              ))}
              {item.stage === "REJECTED" && <Badge tone="danger">{t("stage.REJECTED")}</Badge>}
            </div>

            <div className="flex flex-wrap gap-2">
              {next && (item.canManage || (item.isAuthor && !GATED.includes(next))) && (
                <Button size="sm" variant="soft" disabled={pending} onClick={() => move(next)}>{t("moveTo", { stage: t(`stage.${next}`) })}</Button>
              )}
              {item.canManage && item.stage !== "REJECTED" && item.stage !== "IN_JIRA" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => move("REJECTED")}>{t("stage.REJECTED")}</Button>}
              {item.canManage && item.stage === "REJECTED" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => move("IDEA")}>{t("stage.IDEA")}</Button>}
              {item.jiraKey && item.jiraUrl && <Button size="sm" asChild><a href={item.jiraUrl} target="_blank" rel="noreferrer"><ExternalLink />{t("openInJira")} · {item.jiraKey}</a></Button>}
              {item.jiraKey && !item.jiraUrl && <Badge tone="info">{item.jiraKey}</Badge>}
              {(item.canManage || item.isAuthor) && (
                <Button size="sm" variant="ghost" className="ms-auto text-danger" onClick={() => {
                  if (!confirm(t("deleteConfirm"))) return;
                  start(async () => { await deleteBacklogItemAction(item.id); router.refresh(); onClose(); });
                }}><Trash2 />{tc("delete")}</Button>
              )}
            </div>

            {item.stage === "VALIDATED" && item.canManage && (
              <div className="rounded-xl border border-[#2684ff]/30 bg-[#2684ff]/[0.06] p-4">
                {!item.jiraConfigured && <p className="mb-2 text-xs text-fg-muted">{t("jiraNotConfigured")}</p>}
                <div className="flex flex-wrap items-end gap-2">
                  {!item.jiraConfigured && <Field label={t("jiraManual")} className="w-48"><Input value={jiraKey} onChange={(e) => setJiraKey(e.target.value)} placeholder="PROJ-123" /></Field>}
                  <Button
                    variant="primary"
                    disabled={pending || (!item.jiraConfigured && !jiraKey)}
                    onClick={() => start(async () => {
                      const r = await sendToJiraAction(item.id, item.jiraConfigured ? undefined : jiraKey);
                      if (!r.ok) return void toast.error(r.error);
                      toast.success(t("sentToJira", { key: r.data!.key }));
                      router.refresh();
                      reload(item.id);
                    })}
                    className="bg-[#2684ff] hover:bg-[#1f6fd9]"
                  >{pending ? <Loader2 className="animate-spin" /> : <Send />}{t("sendToJira")}</Button>
                </div>
              </div>
            )}

            <ItemForm key={item.id + item.stage} item={item} onDone={() => reload(item.id)} />

            <div>
              <div className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold"><MessageSquare className="size-4 text-fg-subtle" />{t("comments")}</div>
              <ul className="space-y-3">
                {item.comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    {c.author ? <Avatar id={c.author.id} firstName={c.author.firstName} lastName={c.author.lastName} size={26} /> : <span className="size-[26px] rounded-full bg-bg-subtle" />}
                    <div className="min-w-0 flex-1 rounded-xl bg-bg-subtle px-3 py-2">
                      <div className="text-xs"><span className="font-medium">{c.authorName}</span> <span className="text-fg-subtle">· {fmtDate(c.createdAt, locale, { hour: "2-digit", minute: "2-digit" })}</span></div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[13px]">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  start(async () => { await addCommentAction(item.id, comment); setComment(""); reload(item.id); router.refresh(); });
                }}
              >
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t("addComment")} />
                <Button type="submit" disabled={pending || !comment.trim()}>{t("send")}</Button>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function NewIdeaButton({ projects, defaultProjectId }: { projects?: { id: string; name: string }[]; defaultProjectId?: string }) {
  const t = useTranslations("backlog");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Lightbulb />{t("new")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={t("new")} wide>
          <ItemForm projects={projects} defaultProjectId={defaultProjectId ?? projects?.[0]?.id} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Kanban({ items: initial, showProject }: { items: KanbanItem[]; showProject?: boolean }) {
  const t = useTranslations("backlog");
  const tc = useTranslations("common");
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<BacklogStage | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  useEffect(() => setItems(initial), [initial]);

  const columns = useMemo(() => (showRejected ? [...FLOW, "REJECTED" as const] : FLOW), [showRejected]);
  const rejectedCount = items.filter((i) => i.stage === "REJECTED").length;

  const drop = async (stage: BacklogStage) => {
    const it = items.find((i) => i.id === drag);
    setDrag(null);
    setOver(null);
    if (!it || it.stage === stage) return;
    if (stage === "IN_JIRA") return void setOpen(it.id);
    if ((GATED.includes(stage) || GATED.includes(it.stage)) && !it.canManage) return void toast.error(t("onlyOwner"));
    const prev = items;
    setItems(items.map((i) => (i.id === it.id ? { ...i, stage } : i)));
    const r = await moveBacklogItemAction(it.id, stage);
    if (!r.ok) {
      setItems(prev);
      toast.error(r.error === "forbidden" ? t("onlyOwner") : tc("error"));
    } else router.refresh();
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-fg-subtle">
        <span>{t("dragHint")}</span>
        {rejectedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" checked={showRejected} onChange={(e) => setShowRejected(e.target.checked)} className="accent-[var(--accent)]" />{t("showRejected")} ({rejectedCount})</label>
        )}
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-thin sm:mx-0 sm:px-0">
        {columns.map((stage) => {
          const col = items.filter((i) => i.stage === stage).sort((a, b) => (b.rice ?? -1) - (a.rice ?? -1) || a.position - b.position);
          return (
            <div
              key={stage}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={() => drop(stage)}
              className={cn("flex w-72 shrink-0 flex-col rounded-2xl border border-transparent bg-bg-subtle/70 p-2 transition-colors", over === stage && "border-accent bg-accent-soft/50")}
            >
              <div className="flex items-center gap-2 px-2 pb-2 pt-1">
                <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
                <span className="text-[13px] font-semibold">{t(`stage.${stage}`)}</span>
                <span className="text-xs text-fg-subtle tabular">{col.length}</span>
              </div>
              <div className="px-2 pb-2 text-[11px] text-fg-subtle">{t(`stageHint.${stage}`)}</div>
              <div className="flex min-h-24 flex-1 flex-col gap-2">
                {col.map((i) => (
                  <button
                    key={i.id}
                    draggable
                    onDragStart={() => setDrag(i.id)}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    onClick={() => setOpen(i.id)}
                    className={cn("group rounded-xl border border-border bg-surface p-3 text-start shadow-sm transition-all hover:border-border-strong hover:shadow-md", drag === i.id && "opacity-40")}
                  >
                    {showProject && (
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: `${i.project.color}1a`, color: i.project.color }}>{i.project.name}</div>
                    )}
                    <div className="text-[13px] font-medium leading-snug">{i.title}</div>
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-fg-subtle">
                      <span className="font-mono">{i.project.key}-{i.number}</span>
                      {i.rice != null && <span className="rounded bg-accent-soft px-1 font-semibold text-accent tabular" title="RICE">{i.rice}</span>}
                      {i.comments > 0 && <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" />{i.comments}</span>}
                      {i.jiraKey && <span className="rounded bg-[#2684ff]/10 px-1 font-mono font-semibold text-[#2684ff]">{i.jiraKey}</span>}
                      {i.author && <span className="ms-auto"><Avatar id={i.author.id} firstName={i.author.firstName} lastName={i.author.lastName} size={20} /></span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ItemDialog id={open} onClose={() => setOpen(null)} />
    </div>
  );
}
