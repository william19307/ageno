'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bot, Plus, MessageSquare, Settings } from 'lucide-react'
import { createAgent } from './actions'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorBanner } from '@/components/common/error-banner'
import {
  Dialog,
  DialogActionPrimary,
  DialogActionSecondary,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type AgentCardRow = {
  id: string
  name: string
  description?: string | null
  emoji: string
  status: string
  is_preset: boolean
  skill_count: number
}

export type SkillOption = {
  id: string
  name: string
  key: string
  category: string
  description?: string | null
}

const CATEGORY_LABEL: Record<string, string> = {
  legal: '法务',
  finance: '财务',
  admin: '行政',
  customer: '客户',
}

export default function AgentsView({
  initialAgents,
  skills,
  listError,
}: {
  initialAgents: AgentCardRow[]
  skills: SkillOption[]
  listError?: string | null
}) {
  const router = useRouter()
  const [agents, setAgents] = useState(initialAgents)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    setAgents(initialAgents)
  }, [initialAgents])

  return (
    <div className="p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      {listError && (
        <div className="mb-4">
          <ErrorBanner message={listError} />
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Agent
        </h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)')}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)')}
        >
          <Plus className="size-4" strokeWidth={1.5} />
          新建 Agent
        </button>
      </div>

      {agents.length === 0 && !listError ? (
        <EmptyState
          icon={Bot}
          title="还没有 Agent"
          description="创建自建 Agent，配置 Skill 与文件权限。"
          actionLabel="创建第一个 Agent"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="group relative rounded-lg p-4 transition-colors"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.borderColor = 'var(--border-default)'
              }}
            >
              <div className="text-[32px] leading-none">{agent.emoji}</div>
              <h2 className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {agent.name}
              </h2>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {agent.description || '—'}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    background:
                      agent.status === 'running'
                        ? 'var(--accent)'
                        : agent.status === 'offline'
                          ? 'var(--text-disabled)'
                          : 'var(--success)',
                  }}
                />
                <span>{agent.status === 'running' ? '执行中' : agent.status === 'offline' ? '离线' : '在线'}</span>
                <span className="font-mono">{agent.skill_count} 个 Skill</span>
              </div>
              <div
                className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100"
                style={{ pointerEvents: 'auto' }}
              >
                <Link
                  href={`/chat/${agent.id}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <MessageSquare className="size-3.5" strokeWidth={1.5} />
                  对话
                </Link>
                <Link
                  href={`/agents/${agent.id}`}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium"
                  style={{
                    borderColor: 'var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Settings className="size-3.5" strokeWidth={1.5} />
                  设置
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <NewAgentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        skills={skills}
        onCreated={id => {
          setModalOpen(false)
          router.refresh()
          router.push(`/agents/${id}`)
        }}
      />
    </div>
  )
}

function NewAgentModal({
  open,
  onOpenChange,
  skills,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  skills: SkillOption[]
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [filePermission, setFilePermission] = useState<'owner' | 'company'>('owner')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  function toggleSkill(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!name.trim()) {
      setErr('请填写 Agent 名称')
      return
    }
    setLoading(true)
    const r = await createAgent({
      name,
      description,
      system_prompt: systemPrompt,
      skill_ids: [...selected],
      file_permission: filePermission,
    })
    setLoading(false)
    if (r.error) {
      setErr(r.error)
      return
    }
    if (r.id) {
      setName('')
      setDescription('')
      setSystemPrompt('')
      setSelected(new Set())
      setFilePermission('owner')
      onCreated(r.id)
    }
  }

  const grouped = skills.reduce<Record<string, SkillOption[]>>((acc, s) => {
    const c = s.category || 'other'
    if (!acc[c]) acc[c] = []
    acc[c].push(s)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" showCloseButton>
        <DialogHeader>
          <DialogTitle>新建 Agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {err && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {err}
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Agent 名称
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入 Agent 名称"
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
              placeholder="输入 Agent 描述"
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
              placeholder="You are a helpful assistant..."
              rows={5}
              className="min-h-[120px] border-[var(--border-default)] bg-[var(--bg-surface)] text-sm resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Skill 选择（多选）
            </Label>
            <div
              className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-base)' }}
            >
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <p className="mb-1 text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    {CATEGORY_LABEL[cat] || cat}
                  </p>
                  {list.map(s => (
                    <label key={s.id} className="flex cursor-pointer items-start gap-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSkill(s.id)}
                        className="mt-0.5"
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.name}
                        </span>{' '}
                        {s.description ? `· ${s.description}` : ''}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              文件权限范围
            </Label>
            <select
              value={filePermission}
              onChange={e => setFilePermission(e.target.value as 'owner' | 'company')}
              className="h-9 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--accent)]"
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
          <div className="flex justify-end gap-2 pt-1">
            <DialogActionSecondary type="button" onClick={() => onOpenChange(false)}>
              取消
            </DialogActionSecondary>
            <DialogActionPrimary type="submit" disabled={loading}>
              {loading ? '创建中…' : '创建'}
            </DialogActionPrimary>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
