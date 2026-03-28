'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { inviteMember, updateOrganizationName } from '../actions'
import {
  Dialog,
  DialogActionPrimary,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorBanner } from '@/components/common/error-banner'
import { EmptyState } from '@/components/common/empty-state'
import { Users } from 'lucide-react'

export type MemberRow = {
  id: string
  name: string | null
  role: string
  created_at: string
}

export default function OrgSettingsView({
  orgName,
  isAdmin,
  members,
  listError,
}: {
  orgName: string
  isAdmin: boolean
  members: MemberRow[]
  listError: string | null
}) {
  const router = useRouter()
  const [name, setName] = useState(orgName)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function saveOrg() {
    if (!isAdmin) return
    setErr(null)
    startTransition(async () => {
      const r = await updateOrganizationName(name)
      if (r.error) setErr(r.error)
      else router.refresh()
    })
  }

  function sendInvite() {
    setErr(null)
    startTransition(async () => {
      const r = await inviteMember(inviteEmail, inviteRole)
      if (r.error) setErr(r.error)
      else {
        setInviteOpen(false)
        setInviteEmail('')
        router.refresh()
      }
    })
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        组织设置
      </h1>
      {(listError || err) && (
        <ErrorBanner message={listError || err || ''} onDismiss={() => setErr(null)} />
      )}

      <section
        className="rounded-lg border p-4"
        style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          基本信息
        </h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              公司名称
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!isAdmin}
              className="h-9 border-[var(--border-default)] bg-[var(--bg-base)] text-sm"
            />
          </div>
          <button
            type="button"
            disabled={!isAdmin || pending}
            onClick={saveOrg}
            className="h-9 rounded-md px-3 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            保存
          </button>
        </div>
        <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Logo 上传（48×48）将在存储接入后开放
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            成员管理
          </h2>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className="h-8 rounded-md px-3 text-xs font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              邀请成员
            </button>
          )}
        </div>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="暂无成员数据" description="刷新页面或检查组织配置。" />
        ) : (
          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                  <th className="px-3 py-2 text-xs font-medium">成员</th>
                  <th className="px-3 py-2 text-xs font-medium">角色</th>
                  <th className="px-3 py-2 text-xs font-medium">加入时间</th>
                  <th className="px-3 py-2 text-xs font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>
                      {m.name || m.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                      {m.role === 'admin' ? '管理员' : '成员'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(m.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {isAdmin ? '管理' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          集成
        </h2>
        <ul
          className="divide-y rounded-lg border"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
        >
          {[
            { name: '微信', status: '已连接', action: '管理', disabled: false },
            { name: '企业微信', status: '未配置', action: '配置', disabled: false },
            { name: '钉钉', status: '即将支持', action: '配置', disabled: true },
            { name: '飞书', status: '即将支持', action: '配置', disabled: true },
          ].map(row => (
            <li key={row.name} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {row.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {row.status}
                </p>
              </div>
              <button
                type="button"
                disabled={row.disabled}
                className="h-8 rounded-md border px-3 text-xs font-medium disabled:opacity-40"
                style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
              >
                {row.action}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>邀请成员</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">邮箱</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">角色</Label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
                className="h-9 w-full rounded-md border px-2 text-sm"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="member">成员</option>
                <option value="admin">管理员</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <DialogActionPrimary
              type="button"
              onClick={sendInvite}
              disabled={pending || !inviteEmail.trim()}
            >
              发送邀请
            </DialogActionPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
