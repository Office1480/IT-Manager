import { useTranslations } from "next-intl";
import type { EmployeeStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const TONE: Record<EmployeeStatus, "success" | "info" | "warning" | "neutral"> = {
  ACTIVE: "success",
  ONBOARDING: "info",
  OFFBOARDING: "warning",
  OFFBOARDED: "neutral",
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const t = useTranslations("people.status");
  return (
    <Badge tone={TONE[status]} dot>
      {t(status)}
    </Badge>
  );
}
