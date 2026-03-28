'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/common/error-banner'

export default function SecurityForm({ email }: { email: string }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setOk(false)
    if (next.length < 6) {
      setErr('新密码至少 6 位')
      return
    }
    if (next !== confirm) {
      setErr('两次输入的新密码不一致')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    })
    if (signErr) {
      setLoading(false)
      setErr('当前密码不正确')
      return
    }
    const { error: upErr } = await supabase.auth.updateUser({ password: next })
    setLoading(false)
    if (upErr) setErr(upErr.message)
    else {
      setOk(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    }
  }

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-5">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        账号安全
      </h1>
      {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
      {ok && (
        <p className="text-sm" style={{ color: 'var(--success)' }}>
          密码已更新
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            当前密码
          </Label>
          <Input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            新密码
          </Label>
          <Input
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            autoComplete="new-password"
            className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            确认新密码
          </Label>
          <Input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-9 w-fit rounded-md px-4 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {loading ? '提交中…' : '修改密码'}
        </button>
      </form>
    </div>
  )
}
