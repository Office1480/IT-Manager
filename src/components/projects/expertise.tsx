import { cn } from "@/lib/utils";

export function Expertise({ level, color = "var(--accent)", className }: { level: number; color?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${level}/5`} title={`${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="h-1.5 w-3 rounded-full" style={{ background: i <= level ? color : "var(--border)" }} />
      ))}
    </span>
  );
}
