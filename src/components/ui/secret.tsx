"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function Secret({ value }: { value: string | null }) {
  const [shown, setShown] = useState(false);
  if (!value) return <>—</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular">{shown ? value : "•".repeat(Math.max(0, value.length - 4)) + value.slice(-4)}</span>
      <button type="button" onClick={() => setShown((s) => !s)} className="text-fg-subtle hover:text-fg">
        {shown ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}
