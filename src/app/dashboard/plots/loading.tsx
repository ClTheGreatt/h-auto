export default function PlotsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-24 skeleton rounded" />
          <div className="h-4 w-64 skeleton rounded" />
        </div>
        <div className="h-10 w-32 skeleton rounded-md" />
      </div>

      <div className="bg-card border rounded-md overflow-hidden">
        <div className="border-b p-4 grid grid-cols-7 gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-4 skeleton rounded" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="border-b p-4 grid grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-4 skeleton rounded" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}