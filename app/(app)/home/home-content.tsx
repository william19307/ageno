'use client'

import Link from 'next/link'
import { AlertTriangle, Loader2, CheckCircle, ChevronDown, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatTokens } from '@/lib/utils'
import { TokenWarningBanner } from '@/components/common/token-warning-banner'

export type HomeUrgentItem = { id: string; text: string }
export type HomeRunningTask = {
  id: string
  agentEmoji: string
  agentName: string
  task: string
  time: string
}
export type HomePendingOutput = { id: string; text: string }
export type HomeAgentStatus = {
  id: string
  emoji: string
  name: string
  status: string
  statusText: string
}

interface HomeContentProps {
  userName: string
  greeting: string
  dateStr: string
  monthTokens: number
  monthCost: number
  taskCount: number
  tokenWarning?: boolean
  tokenUsed?: number
  tokenQuota?: number
  urgentItems: HomeUrgentItem[]
  runningTasks: HomeRunningTask[]
  pendingOutputs: HomePendingOutput[]
  agentStatuses: HomeAgentStatus[]
  snapshotRows: { label: string; value: string; sub?: string }[]
  yesterdaySummary: string
}

export default function HomeContent({
  userName,
  greeting,
  dateStr,
  monthTokens,
  monthCost,
  taskCount,
  tokenWarning,
  tokenUsed,
  tokenQuota,
  urgentItems,
  runningTasks,
  pendingOutputs,
  agentStatuses,
  snapshotRows,
  yesterdaySummary,
}: HomeContentProps) {
  const router = useRouter()

  return (
    <div className="p-6 flex flex-col gap-5 animate-page-enter">
      {tokenWarning && tokenUsed != null && tokenQuota != null && (
        <TokenWarningBanner
          message={`组织 Token 已用 ${formatTokens(tokenUsed)} / ${formatTokens(tokenQuota)}，接近或超出配额，请及时充值。`}
        />
      )}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          {greeting}，{userName} · {dateStr}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {urgentItems.length > 0
            ? `今天有 ${urgentItems.length} 件事需要你关注`
            : '暂无紧急事项，一切正常'}
        </p>
      </div>

      <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

      <div className="flex gap-5 flex-1">
        <div className="flex flex-col gap-4" style={{ flex: '1 1 0' }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle size={12} style={{ color: 'var(--warning)' }} />
              <span
                className="uppercase tracking-widest"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                紧急
              </span>
            </div>

            {urgentItems.length === 0 ? (
              <p className="px-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                无待介入或即将到期的任务
              </p>
            ) : (
              urgentItems.map(item => (
                <div
                  key={item.id}
                  className="rounded-lg px-4 py-3 flex flex-col gap-2"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
                >
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {item.text}
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/tasks"
                      className="px-2 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      去工作台
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Loader2 size={12} className="animate-spin-slow" style={{ color: 'var(--accent)' }} />
              <span
                className="uppercase tracking-widest"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                Agent 进行中
              </span>
            </div>

            {runningTasks.length === 0 ? (
              <p className="text-sm px-1" style={{ color: 'var(--text-tertiary)' }}>
                暂无进行中的任务
              </p>
            ) : (
              <div
                className="rounded-lg"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
              >
                {runningTasks.map((task, i) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-4"
                    style={{
                      height: '36px',
                      borderBottom: i < runningTasks.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-sm shrink-0">
                        {task.agentEmoji} {task.agentName}
                      </span>
                      <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                        · {task.task}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {task.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {pendingOutputs.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <span style={{ fontSize: '12px' }}>📬</span>
                <span
                  className="uppercase tracking-widest"
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
                >
                  待确认产出
                </span>
              </div>
              <div
                className="rounded-lg"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
              >
                {pendingOutputs.map((output, i) => (
                  <div
                    key={output.id}
                    className="flex items-center justify-between px-4"
                    style={{
                      height: '36px',
                      borderBottom: i < pendingOutputs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    <span className="truncate text-sm" style={{ color: 'var(--text-primary)' }}>
                      {output.text}
                    </span>
                    <Link
                      href="/tasks"
                      className="shrink-0 text-xs px-2 py-1 rounded transition-all"
                      style={{
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent-border)',
                        color: 'var(--accent)',
                      }}
                    >
                      查看
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <details className="group">
            <summary className="flex items-center gap-2 px-1 cursor-pointer list-none" style={{ userSelect: 'none' }}>
              <CheckCircle size={12} style={{ color: 'var(--success)' }} />
              <span
                className="uppercase tracking-widest"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                昨日完成
              </span>
              <ChevronDown
                size={12}
                style={{ color: 'var(--text-tertiary)', transition: 'transform 150ms' }}
                className="group-open:rotate-180"
              />
            </summary>
            <div className="mt-2 pl-1">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {yesterdaySummary}
              </p>
            </div>
          </details>
        </div>

        <div className="flex flex-col gap-4" style={{ width: '380px', flexShrink: 0 }}>
          <div
            className="rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div
              className="px-4 flex items-center"
              style={{ height: '36px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span
                className="uppercase tracking-widest"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                业务快照
              </span>
            </div>
            {snapshotRows.map((item, i, arr) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-4"
                style={{
                  height: '44px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {item.label}
                  </p>
                  {item.sub && (
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {item.sub}
                    </p>
                  )}
                </div>
                <span
                  className="font-semibold"
                  style={{
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-2xl)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div
            className="rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div
              className="px-4 flex items-center"
              style={{ height: '36px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span
                className="uppercase tracking-widest"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                本月概览
              </span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              {[
                { label: 'Token', value: formatTokens(monthTokens) },
                { label: '费用', value: `¥ ${monthCost.toFixed(2)}` },
                { label: '任务', value: `${taskCount} 完成` },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                  <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <div
              className="px-4 flex items-center justify-between"
              style={{ height: '36px', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span
                className="uppercase tracking-widest"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
              >
                Agent 状态
              </span>
              <button
                type="button"
                className="transition-all"
                style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                onClick={() => router.refresh()}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                <RefreshCw size={12} />
              </button>
            </div>
            {agentStatuses.map((agent, i, arr) => (
              <div
                key={agent.id}
                className="flex items-center justify-between px-4"
                style={{
                  height: '36px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{agent.emoji}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {agent.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: agent.status === 'running' ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}
                  />
                  <span
                    className="text-xs font-mono"
                    style={{
                      color: agent.status === 'running' ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}
                  >
                    {agent.statusText}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
