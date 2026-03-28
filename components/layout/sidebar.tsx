'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  House,
  ListChecks,
  Folder,
  BarChart2,
  Bot,
  MessageSquare,
  Settings,
  Building2,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_SECTIONS = [
  {
    label: 'WORKSPACE',
    items: [
      { href: '/home',  icon: House,        label: '启动台' },
      { href: '/tasks', icon: ListChecks,   label: '工作台' },
      { href: '/files', icon: Folder,       label: '文件空间' },
      { href: '/usage', icon: BarChart2,    label: '用量统计' },
    ],
  },
  {
    label: 'AGENTS',
    items: [
      { href: '/agents', icon: Bot,           label: 'Agent 管理' },
      { href: '/chat',   icon: MessageSquare, label: 'Agent 对话' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/home') return pathname === '/home'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: '220px',
        background: 'var(--bg-base)',
        borderRight: '1px solid var(--border-subtle)',
        height: 'calc(100vh - 52px)',
        overflowY: 'auto',
      }}
    >
      {/* 导航区 */}
      <nav className="flex flex-col gap-0.5 flex-1 p-2 pt-3">
        {NAV_SECTIONS.map(section => (
          <div key={section.label} className="flex flex-col gap-0.5">
            {/* 分组标签 */}
            <p
              className="px-2.5 mb-0.5 mt-4 first:mt-0"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {section.label}
            </p>

            {/* 导航项 */}
            {section.items.map(item => {
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md transition-all"
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    background: active ? 'var(--bg-elevated)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: '500',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-elevated)'
                      ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)'
                    }
                  }}
                >
                  <Icon
                    size={14}
                    strokeWidth={1.5}
                    style={{ flexShrink: 0, color: 'inherit' }}
                  />
                  <span style={{ fontSize: 'var(--text-sm)' }}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* 底部：设置 + 退出 */}
      <div
        className="flex flex-col gap-0.5 p-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      >
        <Link
          href="/settings/profile"
          className="flex items-center gap-2 rounded-md transition-all"
          style={{
            height: '32px',
            padding: '0 10px',
            color:
              pathname.startsWith('/settings') && !pathname.startsWith('/settings/organization')
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            background:
              pathname.startsWith('/settings') && !pathname.startsWith('/settings/organization')
                ? 'var(--bg-elevated)'
                : 'transparent',
          }}
          onMouseEnter={e => {
            const active =
              pathname.startsWith('/settings') && !pathname.startsWith('/settings/organization')
            if (!active) {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-elevated)'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
            }
          }}
          onMouseLeave={e => {
            const active =
              pathname.startsWith('/settings') && !pathname.startsWith('/settings/organization')
            if (!active) {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)'
            }
          }}
        >
          <Settings size={14} strokeWidth={1.5} style={{ color: 'inherit' }} />
          <span>个人设置</span>
        </Link>

        <Link
          href="/settings/organization"
          className="flex items-center gap-2 rounded-md transition-all"
          style={{
            height: '32px',
            padding: '0 10px',
            color: pathname.startsWith('/settings/organization') ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            background: pathname.startsWith('/settings/organization') ? 'var(--bg-elevated)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (!pathname.startsWith('/settings/organization')) {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-elevated)'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
            }
          }}
          onMouseLeave={e => {
            if (!pathname.startsWith('/settings/organization')) {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)'
            }
          }}
        >
          <Building2 size={14} strokeWidth={1.5} style={{ color: 'inherit' }} />
          <span>组织设置</span>
        </Link>

        <Link
          href="/billing"
          className="flex items-center gap-2 rounded-md transition-all"
          style={{
            height: '32px',
            padding: '0 10px',
            color: pathname.startsWith('/billing') ? 'var(--text-primary)' : 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            background: pathname.startsWith('/billing') ? 'var(--bg-elevated)' : 'transparent',
          }}
          onMouseEnter={e => {
            if (!pathname.startsWith('/billing')) {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-elevated)'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'
            }
          }}
          onMouseLeave={e => {
            if (!pathname.startsWith('/billing')) {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-tertiary)'
            }
          }}
        >
          <CreditCard size={14} strokeWidth={1.5} style={{ color: 'inherit' }} />
          <span>计费</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-md transition-all w-full text-left"
          style={{
            height: '32px',
            padding: '0 10px',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
            fontWeight: '500',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger-dim)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'
          }}
        >
          <LogOut size={14} strokeWidth={1.5} style={{ color: 'inherit' }} />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  )
}
