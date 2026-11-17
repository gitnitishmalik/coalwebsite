/** Instant skeleton while an admin page loads — no blank flash between pages. */
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="border-b bg-white px-4 py-6 md:px-8">
        <div className="h-7 w-64 rounded-lg bg-muted" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-muted/70" />
      </div>
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border bg-white p-5">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-4 h-8 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="h-72 rounded-2xl border bg-white" />
        <div className="h-96 rounded-2xl border bg-white" />
      </div>
    </div>
  );
}
