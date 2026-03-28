'use client'

import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4" data-empty-state="sta-01">
      <Icon className="size-10 shrink-0" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.25} />
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)')}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
