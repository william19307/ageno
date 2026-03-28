'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/home')
    })
  }, [router, supabase])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? '邮箱或密码错误，请重试'
        : error.message)
      setLoading(false)
      return
    }

    router.push('/home')
  }

  return (
    <div
      className="w-[360px] rounded-xl p-8 flex flex-col gap-6"
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 h-10">
        <span
          className="text-xl font-bold"
          style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
        >
          A
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          geno
        </span>
      </div>

      {/* 标题 */}
      <div className="flex flex-col items-center gap-1.5">
        <h1
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)' }}
        >
          欢迎回来
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          登录你的工作台
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          className="px-3 py-2 rounded-md text-sm"
          style={{
            background: 'var(--danger-dim)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleLogin} className="flex flex-col gap-3">
        {/* 邮箱 */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="h-9 rounded-md px-3 text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--accent)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border-default)'
            }}
          />
        </div>

        {/* 密码 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              className="text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              密码
            </label>
            <Link
              href="#"
              className="text-xs transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              忘记密码
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-9 rounded-md px-3 text-sm outline-none transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => {
              e.target.style.borderColor = 'var(--accent)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'var(--border-default)'
            }}
          />
        </div>

        {/* 登录按钮 */}
        <button
          type="submit"
          disabled={loading}
          className="h-9 rounded-md text-sm font-medium text-white transition-all flex items-center justify-center mt-1"
          style={{
            background: loading ? 'var(--text-tertiary)' : 'var(--accent)',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={e => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'
          }}
          onMouseLeave={e => {
            if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
          }}
        >
          {loading ? '登录中...' : '登 录'}
        </button>
      </form>

      {/* 分隔线 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>or</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </div>

      {/* 注册链接 */}
      <div className="flex items-center justify-center gap-1">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          还没有账号？
        </span>
        <Link
          href="/register"
          className="text-sm transition-colors"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
        >
          免费注册
        </Link>
      </div>
    </div>
  )
}
