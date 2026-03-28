'use client'

import Link from 'next/link'

/** STA-05：Token 不足警告，叠加在内容上方 */
export function TokenWarningBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
      style={{
        background: 'var(--danger-dim)',
        border: '1px solid var(--danger-border)',
        color: 'var(--danger)',
      }}
      data-token-warning="sta-05"
    >
      <span>{message}</span>
      <Link href="/billing" className="shrink-0 font-medium underline" style={{ color: 'var(--danger)' }}>
        去购买 Token
      </Link>
    </div>
  )
}
