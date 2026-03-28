'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ListChecks,
  Plus,
  X,
  Loader2,
  Circle,
  CircleDot,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import type { TaskPriority, TaskStatus } from '@/types'
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  taskStatusColor,
  PRIORITY_LABEL,
  priorityDotColor,
} from '@/lib/task-ui'
import { createTask, updateTask, getTaskDetail } from './actions'
import {
  Dialog,
  DialogActionPrimary,
  DialogActionSecondary,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorBanner } from '@/components/common/error-banner'

export type TaskRow = {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date?: string | null
  agent_id?: string | null
  created_at: string
  updated_at: string
  agent?: { id: string; name: string; emoji: string } | null
}

export type AgentOption = { id: string; name: string; emoji: string; description?: string | null }

type LogRow = { id: string; content: string; log_type: string; created_at: string }
type OutputRow = { id: string; file_name: string; file_url: string; created_at: string }

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="size-4 shrink-0" style={{ color: 'var(--text-tertiary)' }} strokeWidth={1.5} />
    case 'running':
      return <Loader2 className="size-4 shrink-0 animate-spin-slow" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
    case 'awaiting':
      return <CircleDot className="size-4 shrink-0" style={{ color: 'var(--warning)' }} strokeWidth={1.5} />
    case 'completed':
      return <CheckCircle2 className="size-4 shrink-0" style={{ color: 'var(--success)' }} strokeWidth={1.5} />
    case 'needs_attention':
      return <AlertCircle className="size-4 shrink-0" style={{ color: 'var(--danger)' }} strokeWidth={1.5} />
    default:
      return <HelpCircle className="size-4 shrink-0 text-tertiary" strokeWidth={1.5} />
  }
}

function formatDue(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  const now = new Date()
  const diff = Math.floor((now.getTime() - dt.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export default function TasksView({
  initialTasks,
  agents,
  listError,
}: {
  initialTasks: TaskRow[]
  agents: AgentOption[]
  listError?: string | null
}) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'all'>('all')
  const [filterAgentId, setFilterAgentId] = useState<string | 'all'>('all')
  const [newOpen, setNewOpen] = useState(false)
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<{
    task: TaskRow & { agent?: AgentOption | null }
    logs: LogRow[]
    outputs: OutputRow[]
  } | null>(null)

  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setTasks(initialTasks)
  }, [initialTasks])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        setNewOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterAgentId !== 'all' && t.agent_id !== filterAgentId) return false
      return true
    })
  }, [tasks, filterStatus, filterAgentId])

  const openDrawer = useCallback(async (id: string) => {
    setDrawerTaskId(id)
    const base = tasks.find(t => t.id === id)
    if (base) {
      setDetail({
        task: { ...base, agent: base.agent ?? null },
        logs: [],
        outputs: [],
      })
    }
    setDetailLoading(true)
    const res = await getTaskDetail(id)
    setDetailLoading(false)
    if (res.task && !res.error) {
      setDetail({
        task: res.task as TaskRow & { agent?: AgentOption | null },
        logs: res.logs,
        outputs: res.outputs,
      })
    }
  }, [tasks])

  useEffect(() => {
    if (!drawerTaskId) return
    const t = window.setInterval(async () => {
      const res = await getTaskDetail(drawerTaskId)
      if (res.task && !res.error) {
        setDetail({
          task: res.task as TaskRow & { agent?: AgentOption | null },
          logs: res.logs,
          outputs: res.outputs,
        })
      }
    }, 4000)
    return () => window.clearInterval(t)
  }, [drawerTaskId])

  const closeDrawer = () => {
    setDrawerTaskId(null)
    setDetail(null)
  }

  return (
    <div className="flex h-full min-h-[calc(100vh-52px)]" style={{ background: 'var(--bg-base)' }}>
      {/* 错误条 STA 错误 */}
      {listError && (
        <div className="fixed left-[220px] right-0 top-[52px] z-30">
          <ErrorBanner message={listError} />
        </div>
      )}

      {/* 左侧过滤 160px */}
      <aside
        className="shrink-0 flex flex-col gap-1 py-4 px-2"
        style={{ width: '160px', borderRight: '1px solid var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className="rounded-md px-2 py-1.5 text-left text-sm transition-colors"
          style={{
            background: filterStatus === 'all' ? 'var(--bg-elevated)' : 'transparent',
            color: filterStatus === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          全部任务
        </button>
        <p
          className="px-2 pt-3 pb-1 uppercase tracking-widest"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
        >
          状态
        </p>
        {TASK_STATUS_ORDER.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className="rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            style={{
              background: filterStatus === s ? 'var(--bg-elevated)' : 'transparent',
              color: filterStatus === s ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {TASK_STATUS_LABEL[s]}
          </button>
        ))}
        <p
          className="px-2 pt-3 pb-1 uppercase tracking-widest"
          style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
        >
          Agent
        </p>
        <button
          type="button"
          onClick={() => setFilterAgentId('all')}
          className="rounded-md px-2 py-1.5 text-left text-sm transition-colors"
          style={{
            background: filterAgentId === 'all' ? 'var(--bg-elevated)' : 'transparent',
            color: filterAgentId === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          全部 Agent
        </button>
        {agents.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setFilterAgentId(a.id)}
            className="rounded-md px-2 py-1.5 text-left text-sm transition-colors truncate"
            style={{
              background: filterAgentId === a.id ? 'var(--bg-elevated)' : 'transparent',
              color: filterAgentId === a.id ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {a.emoji} {a.name}
          </button>
        ))}
      </aside>

      {/* 主列表 */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              任务
            </h1>
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium font-mono"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              {filtered.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)')}
          >
            <Plus className="size-4" strokeWidth={1.5} />
            新建任务
            <span className="opacity-60 font-mono text-xs">C</span>
          </button>
        </div>

        {/* 空状态 STA-01 */}
        {filtered.length === 0 && !listError ? (
          <EmptyState
            icon={ListChecks}
            title="暂无任务"
            description="创建任务并指派 Agent，在工作台统一跟进进度。"
            actionLabel="创建第一个任务"
            onAction={() => setNewOpen(true)}
          />
        ) : (
          <div className="px-6 pb-6">
            <div
              className="rounded-lg overflow-hidden"
              style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}
            >
              {filtered.map((task, idx) => {
                const sc = taskStatusColor(task.status)
                const isLast = idx === filtered.length - 1
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openDrawer(task.id)}
                    className="flex w-full items-center gap-3 px-3 text-left transition-colors"
                    style={{
                      height: '36px',
                      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-base)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                  >
                    <StatusIcon status={task.status} />
                    <span className="flex-1 truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                      {task.title}
                    </span>
                    {task.agent && (
                      <span
                        className="hidden shrink-0 rounded px-1.5 py-0.5 text-xs font-mono sm:inline"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' }}
                      >
                        {task.agent.emoji} {task.agent.name}
                      </span>
                    )}
                    <span className="shrink-0 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDue(task.due_date)}
                    </span>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
                      style={{ background: sc.badgeBg, color: sc.badgeText }}
                    >
                      {TASK_STATUS_LABEL[task.status]}
                    </span>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: priorityDotColor(task.priority) }}
                      title={PRIORITY_LABEL[task.priority]}
                    />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <NewTaskModal
        open={newOpen}
        onOpenChange={setNewOpen}
        agents={agents}
        onCreated={() => {
          setNewOpen(false)
          router.refresh()
        }}
      />

      <TaskDetailSheet
        open={!!drawerTaskId}
        taskId={drawerTaskId}
        detail={detail}
        detailLoading={detailLoading}
        agents={agents}
        onClose={closeDrawer}
        onSaved={() => router.refresh()}
        pending={pending}
        startTransition={startTransition}
      />
    </div>
  )
}

function NewTaskModal({
  open,
  onOpenChange,
  agents,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  agents: AgentOption[]
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [due, setDue] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!title.trim()) {
      setErr('请填写标题')
      return
    }
    setLoading(true)
    const r = await createTask({
      title,
      description,
      agent_id: agentId || null,
      priority,
      due_date: due || null,
    })
    setLoading(false)
    if (r.error) {
      setErr(r.error)
      return
    }
    setTitle('')
    setDescription('')
    setAgentId('')
    setPriority('medium')
    setDue('')
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>新建任务</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {err && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {err}
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              标题
            </Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="简要描述要做什么"
              className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              描述
            </Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="详细说明（可选）"
              rows={4}
              className="border-[var(--border-default)] bg-[var(--bg-surface)] text-sm resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                指派 Agent
              </Label>
              <select
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                className="h-9 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--accent)]"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">未指派</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                优先级
              </Label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as TaskPriority)}
                className="h-9 w-full rounded-md border px-2 text-sm outline-none focus:border-[var(--accent)]"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map(p => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              截止日期
            </Label>
            <Input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
            />
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

const sheetOverlay =
  'fixed z-50 bg-[rgba(0,0,0,0.6)] data-ending-style:opacity-0 data-starting-style:opacity-0 left-[220px] top-[52px] right-0 bottom-0'
const sheetClass =
  '!top-[52px] !h-[calc(100vh-52px)] w-[400px] max-w-[400px] !max-w-[400px] p-0 text-[var(--text-primary)] sm:max-w-[400px] gap-0 flex flex-col shadow-none'

function TaskDetailSheet({
  open,
  taskId,
  detail,
  detailLoading,
  agents,
  onClose,
  onSaved,
  pending,
  startTransition,
}: {
  open: boolean
  taskId: string | null
  detail: { task: TaskRow & { agent?: AgentOption | null }; logs: LogRow[]; outputs: OutputRow[] } | null
  detailLoading: boolean
  agents: AgentOption[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  startTransition: (cb: () => void) => void
}) {
  if (!open) return null

  if (!taskId || !detail) {
    return (
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          overlayClassName={sheetOverlay}
          className={`${sheetClass} justify-center`}
        >
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
            <Skeleton className="h-8 w-full bg-[var(--bg-elevated)]" />
            <Skeleton className="h-32 w-full bg-[var(--bg-elevated)]" />
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        overlayClassName={sheetOverlay}
        className={sheetClass}
      >
        <TaskDetailBody
          taskId={taskId}
          detail={detail}
          detailLoading={detailLoading}
          agents={agents}
          onClose={onClose}
          onSaved={onSaved}
          pending={pending}
          startTransition={startTransition}
        />
      </SheetContent>
    </Sheet>
  )
}

function TaskDetailBody({
  taskId,
  detail,
  detailLoading,
  agents,
  onClose,
  onSaved,
  pending,
  startTransition,
}: {
  taskId: string
  detail: { task: TaskRow & { agent?: AgentOption | null }; logs: LogRow[]; outputs: OutputRow[] }
  detailLoading: boolean
  agents: AgentOption[]
  onClose: () => void
  onSaved: () => void
  pending: boolean
  startTransition: (cb: () => void) => void
}) {
  const t = detail.task
  const [title, setTitle] = useState(t.title)
  const [description, setDescription] = useState(t.description ?? '')
  const [agentId, setAgentId] = useState(t.agent_id ?? '')
  const [priority, setPriority] = useState<TaskPriority>(t.priority)
  const [status, setStatus] = useState<TaskStatus>(t.status)
  const [due, setDue] = useState(t.due_date?.slice(0, 10) ?? '')

  useEffect(() => {
    setTitle(detail.task.title)
    setDescription(detail.task.description ?? '')
    setAgentId(detail.task.agent_id ?? '')
    setPriority(detail.task.priority)
    setStatus(detail.task.status)
    setDue(detail.task.due_date?.slice(0, 10) ?? '')
  }, [detail.task])

  function savePatch(patch: Record<string, unknown>) {
    startTransition(async () => {
      await updateTask(taskId, patch as Parameters<typeof updateTask>[1])
      onSaved()
    })
  }

  return (
    <>
      <div
        className="flex shrink-0 items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== detail.task.title) savePatch({ title: title.trim() })
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              执行 Agent
            </span>
            <select
              value={agentId}
              onChange={e => {
                const v = e.target.value
                setAgentId(v)
                savePatch({ agent_id: v || null })
              }}
              disabled={pending}
              className="h-9 w-full rounded-md border px-2 text-sm outline-none"
              style={{
                borderColor: 'var(--border-default)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">未指派</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              状态
            </span>
            <select
              value={status}
              onChange={e => {
                const v = e.target.value as TaskStatus
                setStatus(v)
                savePatch({ status: v })
              }}
              disabled={pending}
              className="h-9 w-full rounded-md border px-2 text-sm outline-none"
              style={{
                borderColor: 'var(--border-default)',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
              }}
            >
              {TASK_STATUS_ORDER.map(s => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              优先级
            </span>
            <div className="flex flex-wrap gap-1">
              {(['urgent', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setPriority(p)
                    savePatch({ priority: p })
                  }}
                  className="flex-1 rounded-md border py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: priority === p ? 'var(--accent)' : 'var(--border-default)',
                    background: priority === p ? 'var(--accent-dim)' : 'var(--bg-base)',
                    color: priority === p ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              截止日期
            </span>
            <Input
              type="date"
              value={due}
              onChange={e => setDue(e.target.value)}
              onBlur={() => savePatch({ due_date: due || null })}
              disabled={pending}
              className="h-9 border-[var(--border-default)] bg-[var(--bg-base)] text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              任务描述
            </span>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={() => {
                if (description !== (detail.task.description ?? '')) {
                  savePatch({ description: description || null })
                }
              }}
              rows={5}
              disabled={pending}
              className="border-[var(--border-default)] bg-[var(--bg-base)] text-sm resize-none"
            />
          </div>

          <div
            className="border-t pt-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              执行日志
            </span>
            {detailLoading ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-full bg-[var(--bg-elevated)]" />
                <Skeleton className="h-4 w-3/4 bg-[var(--bg-elevated)]" />
              </div>
            ) : detail.logs.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                暂无日志
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {detail.logs.map(log => (
                  <li key={log.id} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(log.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{log.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            className="border-t pt-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
            >
              产出文件
            </span>
            {detail.outputs.length === 0 ? (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                暂无产出
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {detail.outputs.map(o => (
                  <li key={o.id}>
                    <a
                      href={o.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {o.file_name}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    </>
  )
}
