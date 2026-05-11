export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-card bg-[#e8e4de] ${className}`} />
}

export function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-card px-4 py-[14px] mb-2 flex items-center gap-3"
      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      <Skeleton className="w-[38px] h-[38px] flex-shrink-0 !rounded-input" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-[14px] w-3/5" />
        <Skeleton className="h-[11px] w-2/5" />
      </div>
    </div>
  )
}

export function SkeletonPersonCard() {
  return (
    <div
      className="bg-white rounded-card mb-[10px] px-[14px] py-[13px] flex items-center gap-2.5"
      style={{ border: '0.5px solid rgba(0,0,0,0.08)' }}
    >
      <Skeleton className="w-8 h-8 flex-shrink-0 !rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-[14px] w-1/3" />
      </div>
    </div>
  )
}
