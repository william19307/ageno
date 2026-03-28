import { Skeleton } from '@/components/ui/skeleton'

export default function AgentsLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      <div className="flex justify-between">
        <Skeleton className="h-8 w-32 bg-[var(--bg-elevated)]" />
        <Skeleton className="h-9 w-28 bg-[var(--bg-elevated)]" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg bg-[var(--bg-elevated)]" />
        ))}
      </div>
    </div>
  )
}
