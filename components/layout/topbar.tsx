'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatTokens } from '@/lib/utils'

interface TopbarProps {
  tokenUsed?: number
  tokenQuota?: number
}

export default function Topbar({ tokenUsed = 0, tokenQuota = 1000000 }: TopbarProps) {
  const [userName, setUserName] = useState('用户')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          '用户'
        )
      }
    })
  }, [])

  const initials = userName.charAt(0).toUpperCase()
  const remaining = tokenQuota - tokenUsed
  const remainingStr = formatTokens(remaining)

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: '52px',
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <span
          className="font-bold text-sm"
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}
        >
          W
        </span>
        <span
          className="font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
        >
          WorkOS
        </span>
      </div>

      {/* 搜索框 */}
      <div
        className="flex items-center gap-2 px-2.5 rounded-md cursor-pointer transition-all"
        style={{
          height: '28px',
          width: '220px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
        }}
        onClick={() => {/* TODO: 全局搜索 ⌘K */}}
      >
        <Search size={12} style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          搜索... ⌘K
        </span>
      </div>

      {/* 右侧：Token余额 + 头像 */}
      <div className="flex items-center gap-3">
        {/* Token 余额徽章 */}
        <div
          className="flex items-center gap-1 px-2 rounded"
          style={{
            height: '22px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
          }}
        >
          <span
            className="font-medium"
            style={{ color: 'var(--accent)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}
          >
            {remainingStr} tokens
          </span>
        </div>

        {/* 用户头像 */}
        <div
          className="flex items-center justify-center rounded-full font-medium text-white text-xs shrink-0"
          style={{
            width: '28px',
            height: '28px',
            background: 'var(--accent)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
