'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/home')
    })
  }, [router, supabase])

  function update(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
        data: {
          name: form.name,
          company_name: form.company.trim() || undefined,
        },
      },
    })

    if (error) {
      setError(
        error.message.includes('already registered')
          ? '该邮箱已注册，请直接登录'
          : error.message
      )
      setLoading(false)
      return
    }

    setLoading(false)

    if (data.session) {
      router.replace('/auth/complete-registration')
      return
    }

    setPendingEmail(form.email.trim())
  }

  const inputStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--accent)'
  }
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = 'var(--border-default)'
  }

  return (
    <div
      className="w-[360px] rounded-xl p-8 flex flex-col gap-5"
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
          W
        </span>
        <span
          className="text-sm font-medium"
          style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
        >
          WorkOS
        </span>
      </div>

      {/* 标题 */}
      <div className="flex flex-col items-center gap-1.5">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          开始14天免费体验
        </h1>
        <p className="text-sm" style={{ color: 'var(--success)' }}>
          无需绑定信用卡
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

      {pendingEmail && (
        <div
          className="px-3 py-3 rounded-md text-sm leading-relaxed"
          style={{
            background: 'var(--success-dim)',
            border: '1px solid var(--success-border, var(--border-default))',
            color: 'var(--text-primary)',
          }}
        >
          验证邮件已发送到 <strong>{pendingEmail}</strong>
          ，请前往邮箱点击确认链接完成注册。
        </div>
      )}

      {pendingEmail && (
        <div className="flex justify-center">
          <Link
            href="/login"
            className="text-sm transition-colors"
            style={{ color: 'var(--accent)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
          >
            已有账号？去登录
          </Link>
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleRegister} className="flex flex-col gap-3" hidden={!!pendingEmail}>
        {[
          { field: 'name', label: '姓名', type: 'text', placeholder: '你的名字', required: true },
          { field: 'email', label: '邮箱', type: 'email', placeholder: 'you@company.com', required: true },
          { field: 'password', label: '密码', type: 'password', placeholder: '至少8位字符', required: true },
          { field: 'company', label: '公司名称（可选）', type: 'text', placeholder: '你的公司', required: false },
        ].map(({ field, label, type, placeholder, required }) => (
          <div key={field} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </label>
            <input
              type={type}
              value={form[field as keyof typeof form]}
              onChange={update(field)}
              placeholder={placeholder}
              required={required}
              minLength={field === 'password' ? 8 : undefined}
              className="h-9 rounded-md px-3 text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
        ))}

        {/* 注册按钮 */}
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
          {loading ? '创建中...' : '创建账号，免费开始'}
        </button>
      </form>

      {!pendingEmail && (
        <>
          <p
            className="text-center leading-relaxed"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}
          >
            注册即表示同意服务条款与隐私政策
          </p>
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              已有账号？
            </span>
            <Link
              href="/login"
              className="text-sm transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-hover)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--accent)')}
            >
              登录
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
