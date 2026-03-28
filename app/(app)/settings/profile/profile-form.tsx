'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfileFields } from '../actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/common/error-banner'

export default function ProfileForm({
  initialName,
  initialPosition,
  initialAvatar,
  email,
}: {
  initialName: string | null
  initialPosition: string | null
  initialAvatar: string | null
  email: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(initialName ?? '')
  const [position, setPosition] = useState(initialPosition ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  function save() {
    setErr(null)
    setOk(false)
    startTransition(async () => {
      const r = await updateProfileFields({
        name: name.trim() || null,
        position: position.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      })
      if (r.error) setErr(r.error)
      else {
        setOk(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-5">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        个人信息
      </h1>
      {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
      {ok && (
        <p className="text-sm" style={{ color: 'var(--success)' }}>
          已保存
        </p>
      )}

      <div className="flex items-center gap-4">
        <div
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            (name || email || '?').slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            头像 URL
          </Label>
          <Input
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          姓名
        </Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          邮箱（只读）
        </Label>
        <Input
          value={email ?? ''}
          readOnly
          className="h-9 border-[var(--border-default)] bg-[var(--bg-base)] text-sm opacity-80"
        />
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          已验证登录邮箱
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          职位 / 角色
        </Label>
        <Input
          value={position}
          onChange={e => setPosition(e.target.value)}
          placeholder="可选"
          className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
        />
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="h-9 w-fit rounded-md px-4 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        保存修改
      </button>
    </div>
  )
}
