'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/settings/profile', label: '个人信息' },
  { href: '/settings/security', label: '账号安全' },
  { href: '/settings/notifications', label: '通知设置' },
  { href: '/settings/organization', label: '组织设置' },
]

export default function SettingsSideNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className="shrink-0 border-r py-5 px-3"
      style={{ width: '160px', borderColor: 'var(--border-subtle)' }}
    >
      <p
        className="mb-3 px-2 text-xs uppercase tracking-widest font-mono"
        style={{ color: 'var(--text-tertiary)' }}
      >
        设置
      </p>
      <nav className="flex flex-col gap-0.5">
        {NAV.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
              style={{
                background: active ? 'var(--bg-elevated)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="mb-2 px-2 text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>
          其他
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors"
          style={{ color: 'var(--text-tertiary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          退出登录
        </button>
      </div>
    </aside>
  )
}
