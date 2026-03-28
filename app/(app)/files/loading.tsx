import { Skeleton } from '@/components/ui/skeleton'

export default function FilesLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      <Skeleton className="h-8 w-48 bg-[var(--bg-elevated)]" />
      <Skeleton className="h-9 w-64 bg-[var(--bg-elevated)]" />
      <Skeleton className="h-10 w-full max-w-2xl bg-[var(--bg-elevated)]" />
      <Skeleton className="h-64 w-full bg-[var(--bg-elevated)]" />
    </div>
  )
}
