/** Skeleton shown while portal pages load. */
export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card h-24 bg-gray-100" />
        ))}
      </div>
      <div className="card p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-5 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
