"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import type { ChecklistKind } from "@prisma/client";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { addTaskAction, deleteTaskAction, generateChecklistAction, toggleTaskAction } from "@/server/phase5-actions";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type TaskRow = { id: string; kind: ChecklistKind; title: string; category: string; done: boolean; doneAt: Date | null; doneByName: string | null };

export function ChecklistPanel({ employeeId, kind, tasks, canWrite }: { employeeId: string; kind: ChecklistKind; tasks: TaskRow[]; canWrite: boolean }) {
  const t = useTranslations("checklist");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("IT");
  const [items, setItems] = useState(tasks);
  useEffect(() => setItems(tasks), [tasks]);
  const done = items.filter((x) => x.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <Card>
      <CardHeader
        title={<span className="inline-flex items-center gap-1.5"><ListChecks className="size-4 text-accent" />{t(kind === "ONBOARDING" ? "onboarding" : "offboarding")}</span>}
        description={items.length ? t("progress", { done, total: items.length }) : undefined}
        action={items.length > 0 && <span className={cn("text-[13px] font-semibold tabular", pct === 100 ? "text-success" : "text-accent")}>{pct} %</span>}
      />
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
          <p className="text-[13px] text-fg-subtle">{t("emptyHint")}</p>
          {canWrite && <Button variant="soft" disabled={pending} onClick={() => run(() => generateChecklistAction(employeeId, kind))}><Sparkles />{t("generate")}</Button>}
        </div>
      ) : (
        <>
          <div className="h-1 bg-bg-subtle"><div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
          <ul className="divide-y divide-border">
            {items.map((x) => (
              <li key={x.id} className="group flex items-center gap-3 px-5 py-2.5">
                <button
                  disabled={!canWrite || pending}
                  onClick={() => { setItems((l) => l.map((i) => (i.id === x.id ? { ...i, done: !i.done } : i))); run(() => toggleTaskAction(x.id, !x.done)); }}
                  className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors", x.done ? "border-success bg-success text-white" : "border-border-strong hover:border-accent")}
                >{x.done && <Check className="size-3" strokeWidth={3} />}</button>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-[13px]", x.done && "text-fg-subtle line-through")}>{x.title}</div>
                  {x.done && x.doneByName && <div className="text-[11px] text-fg-subtle">{t("doneBy", { name: x.doneByName })} · {fmtDate(x.doneAt, locale)}</div>}
                </div>
                <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">{t(`category.${x.category}` as "category.IT")}</span>
                {canWrite && <button onClick={() => run(() => deleteTaskAction(x.id))} className="text-fg-subtle opacity-0 hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></button>}
              </li>
            ))}
          </ul>
          {canWrite && (
            <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; run(() => addTaskAction(employeeId, kind, title, cat)); setTitle(""); }}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("add")} />
              <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-28">{["HR", "IT", "ADMIN", "TEAM"].map((c) => <option key={c} value={c}>{t(`category.${c}` as "category.IT")}</option>)}</Select>
              <Button type="submit" size="icon" disabled={pending}><Plus /></Button>
            </form>
          )}
        </>
      )}
    </Card>
  );
}
