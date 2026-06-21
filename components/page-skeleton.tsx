/** Shimmer placeholder shown while a page loads (used by loading.tsx files). */
export function PageSkeleton({ rows = 6, hasFilters = false }: { rows?: number; hasFilters?: boolean }) {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="h-9 w-28 rounded-lg bg-gray-200" />
      </div>

      {/* Optional filter bar */}
      {hasFilters && (
        <div className="flex gap-3">
          <div className="h-9 w-56 rounded-lg bg-gray-200" />
          <div className="h-9 w-36 rounded-lg bg-gray-200" />
          <div className="h-9 w-36 rounded-lg bg-gray-200" />
        </div>
      )}

      {/* Table card */}
      <div className="card overflow-hidden">
        {/* Table header */}
        <div className="flex gap-6 border-b border-gray-100 bg-gray-50 px-5 py-3">
          {[40, 60, 30, 50, 20].map((w, i) => (
            <div key={i} className={`h-3 rounded bg-gray-200`} style={{ width: `${w}px` }} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-6 border-b border-gray-50 px-5 py-4 last:border-0">
            {[90, 140, 70, 100, 50].map((w, j) => (
              <div key={j} className="h-3 rounded bg-gray-100" style={{ width: `${w}px`, opacity: 1 - i * 0.08 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for pages with a form card layout (teacher/student edit). */
export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-56 rounded-lg bg-gray-200" />
      <div className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-9 w-full rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
        <div className="h-9 w-32 rounded-lg bg-gray-200" />
      </div>
    </div>
  );
}
