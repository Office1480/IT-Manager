export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-7 w-56 rounded-lg bg-bg-subtle" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-subtle" />
        ))}
      </div>
      <div className="h-80 rounded-xl bg-bg-subtle" />
    </div>
  );
}
