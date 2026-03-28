import { Skeleton } from '@/components/ui/skeleton'

export default function TasksLoading() {
  return (
    <div className="flex min-h-[calc(100vh-52px)]" style={{ background: 'var(--bg-base)' }}>
      <div className="flex w-[160px] flex-col gap-2 border-r p-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <Skeleton className="h-8 w-full rounded-md bg-[var(--bg-elevated)]" />
        <Skeleton className="h-6 w-16 bg-[var(--bg-elevated)]" />
        <Skeleton className="h-7 w-full bg-[var(--bg-elevated)]" />
        <Skeleton className="h-7 w-full bg-[var(--bg-elevated)]" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex justify-between">
          <Skeleton className="h-8 w-32 bg-[var(--bg-elevated)]" />
          <Skeleton className="h-9 w-28 rounded-md bg-[var(--bg-elevated)]" />
        </div>
        <Skeleton className="h-[320px] w-full rounded-lg bg-[var(--bg-elevated)]" />
      </div>
    </div>
  )
}
