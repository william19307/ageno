'use client'

import { X } from 'lucide-react'

export function ErrorBanner({
  message,
  className = '',
  onDismiss,
}: {
  message: string
  className?: string
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm ${className}`}
      style={{
        background: 'var(--danger-dim)',
        borderBottom: '1px solid var(--danger-border)',
        color: 'var(--danger)',
      }}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
          aria-label="关闭"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
