export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Welcome skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 skeleton rounded-md" />
        <div className="h-4 w-96 skeleton rounded-md" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border rounded-lg p-5">
            <div className="space-y-3">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="h-8 w-12 skeleton rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card border rounded-lg p-5 space-y-3">
            <div className="h-5 w-32 skeleton rounded" />
            <div className="h-4 w-full skeleton rounded" />
            <div className="h-4 w-3/4 skeleton rounded" />
            <div className="h-4 w-1/2 skeleton rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}