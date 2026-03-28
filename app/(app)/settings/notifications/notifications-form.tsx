'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateNotificationPrefs } from '../actions'
import { Switch } from '@/components/ui/switch'
import { ErrorBanner } from '@/components/common/error-banner'

type Prefs = {
  notification_task_complete: boolean
  notification_deadline_remind: boolean
  notification_daily_home: boolean
  notification_low_token: boolean
}

const ROWS: { key: keyof Prefs; label: string }[] = [
  { key: 'notification_task_complete', label: 'Agent 任务完成通知' },
  { key: 'notification_deadline_remind', label: '到期提醒' },
  { key: 'notification_daily_home', label: '每日启动台推送' },
  { key: 'notification_low_token', label: 'Token 余额不足提醒' },
]

export default function NotificationsForm({ initial }: { initial: Prefs }) {
  const router = useRouter()
  const [prefs, setPrefs] = useState(initial)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(key: keyof Prefs, v: boolean) {
    const next = { ...prefs, [key]: v }
    setPrefs(next)
    setErr(null)
    startTransition(async () => {
      const r = await updateNotificationPrefs({ [key]: v })
      if (r.error) {
        setErr(r.error)
        setPrefs(prefs)
      } else router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-5">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        通知设置
      </h1>
      {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
      <ul
        className="divide-y rounded-lg border"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
      >
        {ROWS.map(row => (
          <li key={row.key} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {row.label}
            </span>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={v => toggle(row.key, v)}
              disabled={pending}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
