export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 skeleton rounded" />
        <div className="h-4 w-72 skeleton rounded" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border rounded-lg p-5 h-24 skeleton-card">
            <div className="h-3 w-20 skeleton rounded mb-3" />
            <div className="h-8 w-12 skeleton rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-5">
        <div className="h-5 w-40 skeleton rounded mb-4" />
        <div className="h-64 skeleton rounded" />
      </div>
    </div>
  );
}