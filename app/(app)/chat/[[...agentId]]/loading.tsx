import { Skeleton } from '@/components/ui/skeleton'

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-52px)]" style={{ background: 'var(--bg-base)' }}>
      <div className="w-[200px] shrink-0 border-r p-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <Skeleton className="mb-2 h-4 w-16 bg-[var(--bg-elevated)]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-14 w-full bg-[var(--bg-elevated)]" />
        ))}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <Skeleton className="mb-4 h-10 w-full max-w-xl bg-[var(--bg-elevated)]" />
        <Skeleton className="h-32 w-2/3 bg-[var(--bg-elevated)]" />
      </div>
    </div>
  )
}
