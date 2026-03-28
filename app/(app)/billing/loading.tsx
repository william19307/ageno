import { Skeleton } from '@/components/ui/skeleton'

export default function BillingLoading() {
  return (
    <div className="flex flex-col gap-4 p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      <Skeleton className="h-8 w-56 bg-[var(--bg-elevated)]" />
      <Skeleton className="h-36 w-full max-w-2xl bg-[var(--bg-elevated)]" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48 bg-[var(--bg-elevated)]" />
        <Skeleton className="h-48 bg-[var(--bg-elevated)]" />
      </div>
    </div>
  )
}
