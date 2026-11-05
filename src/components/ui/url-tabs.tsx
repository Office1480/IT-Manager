"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs } from "./tabs";

/**
 * Onglets instantanés (état local) synchronisés avec ?tab= via l'History API :
 * liens profonds partageables sans aller-retour serveur.
 */
export function UrlTabs({ defaultValue, children, className }: { defaultValue: string; children: React.ReactNode; className?: string }) {
  const sp = useSearchParams();
  const [value, setValue] = useState(sp.get("tab") ?? defaultValue);
  return (
    <Tabs
      value={value}
      className={className}
      onValueChange={(v) => {
        setValue(v);
        const url = new URL(window.location.href);
        if (v === defaultValue) url.searchParams.delete("tab");
        else url.searchParams.set("tab", v);
        window.history.replaceState(window.history.state, "", url);
      }}
    >
      {children}
    </Tabs>
  );
}
