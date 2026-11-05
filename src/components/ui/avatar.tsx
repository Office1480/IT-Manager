import { cn, colorFor, initials } from "@/lib/utils";

export function Avatar({
  firstName,
  lastName,
  id,
  size = 28,
  className,
  ring,
}: {
  firstName: string;
  lastName: string;
  id: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const color = colorFor(id);
  return (
    <span
      title={`${firstName} ${lastName}`}
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white", ring && "ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
    >
      {initials(firstName, lastName)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 24 }: { people: { id: string; firstName: string; lastName: string }[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-1.5 rtl:space-x-reverse">
      {shown.map((p) => (
        <Avatar key={p.id} {...p} size={size} ring />
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center justify-center rounded-full bg-bg-subtle text-[10px] font-medium text-fg-muted ring-2 ring-surface" style={{ width: size, height: size }}>
          +{rest}
        </span>
      )}
    </div>
  );
}
