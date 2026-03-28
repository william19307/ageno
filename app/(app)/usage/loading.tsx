import { Skeleton } from '@/components/ui/skeleton'

export default function UsageLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      <Skeleton className="h-8 w-40 bg-[var(--bg-elevated)]" />
      <Skeleton className="h-9 w-72 bg-[var(--bg-elevated)]" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 bg-[var(--bg-elevated)]" />
        ))}
      </div>
      <Skeleton className="h-48 w-full bg-[var(--bg-elevated)]" />
    </div>
  )
}
