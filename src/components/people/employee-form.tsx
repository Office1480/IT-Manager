"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { createEmployeeAction, updateEmployeeAction } from "@/server/employee-actions";
import { toDateInput } from "@/lib/utils";

type Option = { id: string; firstName?: string; lastName?: string; name?: string };

export type EmployeeFormValues = Partial<{
  id: string;
  employeeNumber: string;
  status: string;
  firstName: string;
  lastName: string;
  firstNameHe: string | null;
  lastNameHe: string | null;
  birthDate: Date | null;
  gender: string | null;
  nationality: string | null;
  maritalStatus: string | null;
  childrenCount: number | null;
  nationalId: string | null;
  passport: string | null;
  email: string;
  personalEmail: string | null;
  phone: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressZip: string | null;
  addressCountry: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  seniorityDate: Date | null;
  contractType: string;
  workPercentage: number;
  workLocation: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  pensionFund: string | null;
  pensionEmployeeRate: unknown;
  pensionEmployerRate: unknown;
  severanceRate: unknown;
  kerenHishtalmut: boolean;
  kerenEmployeeRate: unknown;
  kerenEmployerRate: unknown;
  notes: string | null;
}>;

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={hint} />
      <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</CardBody>
    </Card>
  );
}

export function EmployeeForm({
  initial,
  departments,
  managers,
  canSensitive,
  suggestedNumber,
}: {
  initial?: EmployeeFormValues;
  departments: Option[];
  managers: Option[];
  canSensitive: boolean;
  suggestedNumber?: string;
}) {
  const t = useTranslations("people");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dep, setDep] = useState(initial?.departmentId ?? "");
  const [keren, setKeren] = useState(initial?.kerenHishtalmut ?? false);
  const v = initial ?? {};
  const s = (x: unknown) => (x == null ? "" : String(x));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = v.id ? await updateEmployeeAction(v.id, fd) : await createEmployeeAction(fd);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.fieldErrors ? Object.values(res.fieldErrors)[0] : tc("error"));
        return;
      }
      toast.success(v.id ? tc("saved") : tc("created"));
      router.push(`/people/${res.data!.id}`);
      router.refresh();
    });
  };

  const f = ({ name, type = "text", required, className, ...rest }: { name: keyof EmployeeFormValues; type?: string; required?: boolean; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <Field key={name} label={t(`fields.${name}`)} required={required} error={errors[name]} className={className}>
      <Input
        name={name}
        type={type}
        required={required}
        defaultValue={type === "date" ? toDateInput(v[name] as Date | null) : s(v[name])}
        aria-invalid={!!errors[name]}
        {...rest}
      />
    </Field>
  );


  const sensitiveHint = (
    <span className="inline-flex items-center gap-1">
      <Lock className="size-3" /> {t("sensitiveHint")}
    </span>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-20" noValidate>
      <Section title={t("sections.identity")}>
        {f({ name: "firstName", required: true, autoFocus: true })}
        {f({ name: "lastName", required: true })}
        <Field label={t("fields.employeeNumber")} error={errors.employeeNumber}>
          <Input name="employeeNumber" defaultValue={v.employeeNumber ?? suggestedNumber} />
        </Field>
        {f({ name: "firstNameHe", dir: "rtl" })}
        {f({ name: "lastNameHe", dir: "rtl" })}
        {f({ name: "birthDate", type: "date" })}
        <Field label={t("fields.gender")}>
          <Select name="gender" defaultValue={s(v.gender)}>
            <option value="">—</option>
            {(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"] as const).map((g) => (
              <option key={g} value={g}>{t(`gender.${g}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.maritalStatus")}>
          <Select name="maritalStatus" defaultValue={s(v.maritalStatus)}>
            <option value="">—</option>
            {(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "PARTNERSHIP"] as const).map((g) => (
              <option key={g} value={g}>{t(`marital.${g}`)}</option>
            ))}
          </Select>
        </Field>
        {f({ name: "childrenCount", type: "number", min: 0 })}
        {f({ name: "nationality" })}
        {canSensitive && (
          <>
            {f({ name: "nationalId", inputMode: "numeric", maxLength: 9, placeholder: "000000018" })}
            {f({ name: "passport" })}
          </>
        )}
      </Section>

      <Section title={t("sections.contact")}>
        {f({ name: "email", type: "email", required: true })}
        {f({ name: "personalEmail", type: "email" })}
        {f({ name: "phone", type: "tel" })}
        {f({ name: "addressStreet", className: "lg:col-span-1" })}
        {f({ name: "addressCity" })}
        {f({ name: "addressZip" })}
        {f({ name: "addressCountry" })}
      </Section>

      <Section title={t("sections.emergency")}>
        {f({ name: "emergencyName" })}
        {f({ name: "emergencyPhone", type: "tel" })}
        {f({ name: "emergencyRelation" })}
      </Section>

      <Section title={t("sections.job")}>
        {f({ name: "jobTitle" })}
        <Field label={t("fields.department")}>
          <Select name="departmentId" value={dep} onChange={(e) => setDep(e.target.value)}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
            <option value="__new">+ …</option>
          </Select>
          {dep === "__new" && <Input name="newDepartment" autoFocus placeholder={t("fields.department")} className="mt-1.5" />}
        </Field>
        <Field label={t("fields.manager")} error={errors.managerId}>
          <Select name="managerId" defaultValue={s(v.managerId)}>
            <option value="">—</option>
            {managers.filter((m) => m.id !== v.id).map((m) => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.contractType")}>
          <Select name="contractType" defaultValue={v.contractType ?? "PERMANENT"}>
            {(["PERMANENT", "FIXED_TERM", "FREELANCE", "INTERN"] as const).map((c) => (
              <option key={c} value={c}>{t(`contract.${c}`)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.status")}>
          <Select name="status" defaultValue={v.status ?? "ACTIVE"}>
            {(["ONBOARDING", "ACTIVE", "OFFBOARDING", "OFFBOARDED"] as const).map((c) => (
              <option key={c} value={c}>{t(`status.${c}`)}</option>
            ))}
          </Select>
        </Field>
        {f({ name: "workPercentage", type: "number", min: 1, max: 100, defaultValue: s(v.workPercentage ?? 100) })}
        {f({ name: "startDate", type: "date" })}
        {f({ name: "endDate", type: "date" })}
        {f({ name: "seniorityDate", type: "date" })}
        {f({ name: "workLocation" })}
      </Section>

      {canSensitive && (
        <>
          <Section title={t("sections.bank")} hint={sensitiveHint}>
            {f({ name: "bankName" })}
            {f({ name: "bankBranch" })}
            {f({ name: "bankAccount" })}
          </Section>
          <Section title={t("sections.benefits")} hint={sensitiveHint}>
            {f({ name: "pensionFund" })}
            {f({ name: "pensionEmployeeRate", type: "number", step: "0.01", placeholder: "6" })}
            {f({ name: "pensionEmployerRate", type: "number", step: "0.01", placeholder: "6.5" })}
            {f({ name: "severanceRate", type: "number", step: "0.01", placeholder: "8.33" })}
            <Field label={t("fields.kerenHishtalmut")}>
              <label className="flex h-8 cursor-pointer items-center gap-2 text-[13px]">
                <input type="checkbox" name="kerenHishtalmut" checked={keren} onChange={(e) => setKeren(e.target.checked)} className="size-4 accent-[var(--accent)]" />
                {keren ? tc("yes") : tc("no")}
              </label>
            </Field>
            {keren && (
              <>
                {f({ name: "kerenEmployeeRate", type: "number", step: "0.01", placeholder: "2.5" })}
                {f({ name: "kerenEmployerRate", type: "number", step: "0.01", placeholder: "7.5" })}
              </>
            )}
          </Section>
        </>
      )}

      <Card>
        <CardHeader title={t("sections.notes")} />
        <CardBody>
          <Textarea name="notes" defaultValue={s(v.notes)} rows={4} />
        </CardBody>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/85 backdrop-blur lg:start-60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-10">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? tc("saving") : tc("save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
