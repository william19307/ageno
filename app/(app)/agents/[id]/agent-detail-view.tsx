'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MessageSquare, MessageCircle } from 'lucide-react'
import { formatTokens } from '@/lib/utils'
import { updateAgent, updateAgentSkills } from '../actions'
import type { SkillOption } from '../agents-view'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/common/empty-state'

const CATEGORY_LABEL: Record<string, string> = {
  legal: '法务',
  finance: '财务',
  admin: '行政',
  customer: '客户',
}

const USAGE_TYPE_LABEL: Record<string, string> = {
  chat: '对话',
  file: '文件处理',
  background: '后台任务',
}

export type ConvoPreviewRow = {
  id: string
  title: string | null
  updated_at: string
  preview: string
}

export type AgentTokenLogRow = {
  id: string
  created_at: string
  input_tokens: number
  output_tokens: number
  cost_cny: number | null
  usage_type: string
}

export default function AgentDetailView({
  agent,
  skills,
  initialSkillIds,
  monthTokens,
  monthCost,
  conversations,
  tokenLogs,
  listError,
}: {
  agent: {
    id: string
    name: string
    description?: string | null
    emoji: string
    system_prompt?: string | null
    file_permission: 'owner' | 'company'
    is_preset: boolean
    status: string
    created_at: string
  }
  skills: SkillOption[]
  initialSkillIds: string[]
  monthTokens: number
  monthCost: number
  conversations: ConvoPreviewRow[]
  tokenLogs: AgentTokenLogRow[]
  listError?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description ?? '')
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt ?? '')
  const [filePermission, setFilePermission] = useState(agent.file_permission)
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSkillIds))
  const [msg, setMsg] = useState('')

  function toggleSkill(id: string) {
    if (agent.is_preset) return
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function saveBasics() {
    setMsg('')
    startTransition(async () => {
      const r = await updateAgent(agent.id, {
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim() || null,
        file_permission: filePermission,
      })
      if (r.error) setMsg(r.error)
      else {
        setMsg('已保存')
        router.refresh()
      }
    })
  }

  function saveSkills() {
    if (agent.is_preset) return
    setMsg('')
    startTransition(async () => {
      const r = await updateAgentSkills(agent.id, [...selected])
      if (r.error) setMsg(r.error)
      else {
        setMsg('Skill 已更新')
        router.refresh()
      }
    })
  }

  const grouped = skills.reduce<Record<string, SkillOption[]>>((acc, s) => {
    const c = s.category || 'other'
    if (!acc[c]) acc[c] = []
    acc[c].push(s)
    return acc
  }, {})

  const maxBar =
    tokenLogs.length === 0
      ? 1
      : Math.max(...tokenLogs.map(l => l.input_tokens + l.output_tokens), 1)

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      {listError && (
        <div
          className="rounded-md px-3 py-2 text-sm"
          style={{
            background: 'var(--danger-dim)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
          }}
        >
          {listError}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-4xl leading-none">{agent.emoji}</span>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {agent.name}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {agent.is_preset ? '系统预置 Agent' : '自建 Agent'} ·{' '}
              {agent.status === 'running' ? '执行中' : agent.status === 'offline' ? '离线' : '在线'}
            </p>
            <p className="mt-2 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
              创建于 {new Date(agent.created_at).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <Link
          href={`/chat/${agent.id}`}
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          <MessageSquare className="size-4" strokeWidth={1.5} />
          开始对话
        </Link>
      </div>

      {msg && (
        <p className="text-sm" style={{ color: msg.startsWith('已') ? 'var(--success)' : 'var(--danger)' }}>
          {msg}
        </p>
      )}

      <Tabs defaultValue="conversations" className="w-full gap-4">
        <TabsList
          className="h-9 w-fit gap-0 rounded-md p-0"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <TabsTrigger
            value="conversations"
            className="rounded-none px-4 text-xs data-[state=active]:bg-[var(--bg-elevated)] data-[state=active]:text-[var(--text-primary)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            对话记录
          </TabsTrigger>
          <TabsTrigger
            value="tokens"
            className="rounded-none px-4 text-xs data-[state=active]:bg-[var(--bg-elevated)] data-[state=active]:text-[var(--text-primary)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Token 消耗
          </TabsTrigger>
          <TabsTrigger
            value="profile"
            className="rounded-none px-4 text-xs data-[state=active]:bg-[var(--bg-elevated)] data-[state=active]:text-[var(--text-primary)]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            基本信息
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="mt-0 outline-none">
          {conversations.length === 0 ? (
            <div
              className="rounded-lg border p-6"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
            >
              <EmptyState
                icon={MessageCircle}
                title="暂无对话记录"
                description="与该 Agent 的会话将显示在这里。"
                actionLabel="发起对话"
                onAction={() => router.push(`/chat/${agent.id}`)}
              />
            </div>
          ) : (
            <ul
              className="divide-y rounded-lg border"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
            >
              {conversations.map(c => (
                <li key={c.id}>
                  <Link
                    href={`/chat/${agent.id}`}
                    className="flex flex-col gap-1 px-4 py-3 transition-colors"
                    style={{ color: 'inherit' }}
                    onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg-base)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.background = 'transparent')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.title || '未命名会话'}
                      </span>
                      <span className="shrink-0 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(c.updated_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {c.preview || '—'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tokens" className="mt-0 outline-none">
          <div
            className="mb-4 rounded-lg p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <p className="text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>
              本月累计
            </p>
            <div className="mt-2 flex flex-wrap gap-8">
              <div>
                <p className="text-2xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatTokens(monthTokens)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Token
                </p>
              </div>
              <div>
                <p className="text-2xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                  ¥{monthCost.toFixed(2)}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  费用估算
                </p>
              </div>
            </div>
          </div>
          {tokenLogs.length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
              本月暂无调用明细
            </p>
          ) : (
            <div
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
            >
              <table className="w-full text-left text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                    <th className="px-3 py-2 font-medium">时间</th>
                    <th className="px-3 py-2 font-medium">类型</th>
                    <th className="px-3 py-2 font-medium">消耗</th>
                    <th className="px-3 py-2 font-medium">费用</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenLogs.map(log => {
                    const total = log.input_tokens + log.output_tokens
                    const w = Math.round((total / maxBar) * 100)
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(log.created_at).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                          {USAGE_TYPE_LABEL[log.usage_type] || log.usage_type}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-1 w-16 overflow-hidden rounded-full"
                              style={{ background: 'var(--border-default)' }}
                            >
                              <div className="h-full rounded-full" style={{ width: `${w}%`, background: 'var(--accent)' }} />
                            </div>
                            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                              {formatTokens(total)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          ¥{(log.cost_cny ?? 0).toFixed(3)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="profile" className="mt-0 flex flex-col gap-4 outline-none">
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                名称
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={agent.is_preset || pending}
                className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                描述
              </Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={pending}
                className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                System Prompt
              </Label>
              <Textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                disabled={pending}
                rows={6}
                className="resize-none border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                文件权限范围
              </Label>
              <select
                value={filePermission}
                onChange={e => setFilePermission(e.target.value as 'owner' | 'company')}
                disabled={pending}
                className="h-9 w-full max-w-xs rounded-md border px-2 text-sm"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="owner">仅个人</option>
                <option value="company">公司共享</option>
              </select>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={saveBasics}
              className="h-9 w-fit rounded-md px-4 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--accent)' }}
            >
              保存基本信息
            </button>
          </div>

          <div
            className="rounded-lg p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Skill 模块
              </h2>
              {!agent.is_preset && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={saveSkills}
                  className="text-xs font-medium"
                  style={{ color: 'var(--accent)' }}
                >
                  保存 Skill 选择
                </button>
              )}
            </div>
            {agent.is_preset && (
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                预置 Agent 的 Skill 由系统管理
              </p>
            )}
            <div className="mt-2 max-h-64 space-y-3 overflow-y-auto">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <p className="mb-1 text-xs font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    {CATEGORY_LABEL[cat] || cat}
                  </p>
                  {list.map(s => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-2 py-1 text-xs"
                      style={{ opacity: agent.is_preset ? 0.7 : 1 }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSkill(s.id)}
                        disabled={agent.is_preset}
                        className="mt-0.5"
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                        {s.description ? ` — ${s.description}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
