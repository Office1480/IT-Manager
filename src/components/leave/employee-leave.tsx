import { getTranslations } from "next-intl/server";
import { Card, CardHeader } from "@/components/ui/card";
import { BalanceCards, type BalanceView } from "./balance-cards";
import { RequestsList, type RequestRow } from "./requests-list";
import { AdjustDialog } from "./adjust-dialog";

export async function EmployeeLeave({ employeeId, balances, requests, canAdjust, types }: { employeeId: string; balances: BalanceView[]; requests: RequestRow[]; canAdjust: boolean; types: { id: string; name: string }[] }) {
  const t = await getTranslations("leave");
  return (
    <div className="space-y-5">
      {balances.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">{t("balance")}</h2>
            {canAdjust && <AdjustDialog employeeId={employeeId} types={types} />}
          </div>
          <BalanceCards balances={balances} />
        </div>
      )}
      <Card>
        <CardHeader title={t("requestsOf")} />
        <RequestsList rows={requests} />
      </Card>
    </div>
  );
}
