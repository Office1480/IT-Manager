import { useTranslations } from "next-intl";

export type BalanceView = { code: string; name: string; color: string; accrued: number; taken: number; pending: number; adjust: number; available: number };

export function BalanceCards({ balances }: { balances: BalanceView[] }) {
  const t = useTranslations("leave");
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {balances.map((b) => {
        const total = Math.max(b.accrued + b.adjust, 0.001);
        const usedPct = Math.min(100, (b.taken / total) * 100);
        const pendPct = Math.min(100 - usedPct, (b.pending / total) * 100);
        return (
          <div key={b.code} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted"><span className="size-2 rounded-full" style={{ background: b.color }} />{b.name}</span>
              <span className="text-xs text-fg-subtle">{t("available")}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight tabular">{b.available}</span>
              <span className="text-xs text-fg-subtle">/ {Math.round((b.accrued + b.adjust) * 10) / 10}</span>
            </div>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-bg-subtle">
              <div style={{ width: `${usedPct}%`, background: b.color }} />
              <div style={{ width: `${pendPct}%`, background: `${b.color}66` }} />
            </div>
            <div className="mt-2 flex gap-3 text-[11px] text-fg-subtle tabular">
              <span>{t("taken")} {b.taken}</span>
              {b.pending > 0 && <span>{t("pendingDays")} {b.pending}</span>}
              {b.adjust !== 0 && <span>± {b.adjust}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
