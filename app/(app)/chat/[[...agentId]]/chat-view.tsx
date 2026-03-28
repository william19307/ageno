'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Paperclip, ListTodo, Sparkles, MessageSquare } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { ErrorBanner } from '@/components/common/error-banner'
import { EmptyState } from '@/components/common/empty-state'
import { findMentionedFileIds, type AgentFileBrief } from '@/lib/files-for-agent'

export type ChatAgentRow = {
  id: string
  name: string
  emoji: string
  description?: string | null
  status: string
}

export type ChatMessageRow = {
  id: string
  role: string
  content: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  created_at: string
}

export type ConversationSummary = {
  id: string
  title: string | null
  updated_at: string
}

type UiMessage = ChatMessageRow & { streaming?: boolean; local?: boolean }

const SUGGESTIONS: Record<string, string[]> = {
  default: ['帮我总结今天的工作重点', '起草一封简短的跟进邮件', '列出本周待办清单'],
  legal: ['审查这份合同的风险点', '起草一份保密协议要点', '解释「不可抗力」条款'],
  finance: ['整理本月支出类别', '提醒开票注意事项', '生成简单现金流说明'],
}

export default function ChatView({
  agents,
  activeAgentId,
  initialConversationId,
  initialMessages,
  recentConversations,
  agentFiles,
}: {
  agents: ChatAgentRow[]
  activeAgentId: string
  initialConversationId: string | null
  initialMessages: ChatMessageRow[]
  recentConversations: ConversationSummary[]
  agentFiles: AgentFileBrief[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [attachNames, setAttachNames] = useState<string[]>([])
  const [taskMode, setTaskMode] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [stickyFullFileIds, setStickyFullFileIds] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const assistantAccumRef = useRef('')
  const prevConvRef = useRef<string | null | undefined>(undefined)

  const agent = agents.find(a => a.id === activeAgentId)!

  useEffect(() => {
    setConversationId(initialConversationId)
    setMessages(initialMessages)
  }, [initialConversationId, initialMessages, activeAgentId])

  useEffect(() => {
    const prev = prevConvRef.current === undefined ? null : prevConvRef.current
    prevConvRef.current = initialConversationId
    if (initialConversationId === null) {
      setStickyFullFileIds([])
      return
    }
    if (prev !== null && prev !== initialConversationId) {
      setStickyFullFileIds([])
    }
  }, [initialConversationId])

  useEffect(() => {
    setStickyFullFileIds([])
  }, [activeAgentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    setFlowError(null)
    setStreaming(true)
    assistantAccumRef.current = ''

    const userLine: UiMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: [text, ...(attachNames.length ? [`\n[附件: ${attachNames.join(', ')}]`] : [])].join(''),
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      created_at: new Date().toISOString(),
      local: true,
    }
    setMessages(m => [...m, userLine])

    const assistantId = `stream-${Date.now()}`
    setMessages(m => [
      ...m,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        created_at: new Date().toISOString(),
        streaming: true,
      },
    ])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agentId: activeAgentId,
          conversationId,
          message: taskMode ? `[任务模式] ${text}` : text,
          attachmentNames: attachNames.length ? attachNames : undefined,
          fullFileIds: stickyFullFileIds.length ? stickyFullFileIds : undefined,
        }),
      })

      const newConv = res.headers.get('X-Conversation-Id')
      if (newConv) {
        setConversationId(newConv)
        router.replace(`/chat/${activeAgentId}/${newConv}`)
        router.refresh()
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error((j as { error?: string }).error ?? '请求失败')
      }

      const reader = res.body?.getReader()
      const dec = new TextDecoder()
      if (!reader) throw new Error('无响应流')

      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          try {
            const ev = JSON.parse(raw) as {
              text?: string
              done?: boolean
              usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number }
              error?: string
            }
            if (ev.error) throw new Error(ev.error)
            if (ev.text) {
              assistantAccumRef.current += ev.text
              setMessages(m =>
                m.map(msg =>
                  msg.id === assistantId
                    ? { ...msg, content: msg.content + ev.text }
                    : msg
                )
              )
            }
            if (ev.done && ev.usage) {
              const ids = findMentionedFileIds(assistantAccumRef.current, agentFiles)
              if (ids.length) {
                setStickyFullFileIds(prev => [...new Set([...prev, ...ids])])
              }
              assistantAccumRef.current = ''
              setMessages(m =>
                m.map(msg =>
                  msg.id === assistantId
                    ? {
                        ...msg,
                        streaming: false,
                        input_tokens: ev.usage!.input_tokens,
                        output_tokens: ev.usage!.output_tokens,
                        cache_read_input_tokens: ev.usage!.cache_read_input_tokens,
                      }
                    : msg
                )
              )
            }
          } catch {
            /* ignore parse */
          }
        }
      }
      setAttachNames([])
      setTaskMode(false)
      startTransition(() => router.refresh())
    } catch (e) {
      const msg = e instanceof Error ? e.message : '发送失败'
      setFlowError(msg)
      setMessages(m =>
        m.map(x =>
          x.id === assistantId ? { ...x, streaming: false, content: `错误：${msg}` } : x
        )
      )
    } finally {
      setStreaming(false)
    }
  }

  const suggestions =
    agent.name.includes('法务') ? SUGGESTIONS.legal : agent.name.includes('财务') ? SUGGESTIONS.finance : SUGGESTIONS.default

  return (
    <div className="flex h-[calc(100vh-52px)] min-h-0" style={{ background: 'var(--bg-base)' }}>
      {/* 左侧 Agent 200px */}
      <aside
        className="flex shrink-0 flex-col border-r py-3"
        style={{ width: '200px', borderColor: 'var(--border-subtle)' }}
      >
        <p
          className="px-3 pb-2 text-xs uppercase tracking-widest font-mono"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Agents
        </p>
        <nav className="flex flex-col gap-0.5 px-2">
          {agents.map(a => {
            const active = a.id === activeAgentId
            return (
              <Link
                key={a.id}
                href={`/chat/${a.id}`}
                className="flex flex-col rounded-md px-2 py-2 text-left transition-colors"
                style={{
                  background: active ? 'var(--bg-elevated)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                <span className="text-xs font-medium">
                  {a.emoji} {a.name}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                  {a.description || ' '}
                </span>
                <span className="mt-1 text-[10px] font-mono" style={{ color: 'var(--text-disabled)' }}>
                  {a.status === 'running' ? '● 执行中' : '○ 空闲'}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-3 border-t px-2 pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <p
            className="mb-1.5 px-1 text-[10px] uppercase tracking-widest font-mono"
            style={{ color: 'var(--text-tertiary)' }}
          >
            近期对话
          </p>
          <Link
            href={`/chat/${activeAgentId}`}
            className="mb-1 block rounded-md px-2 py-1.5 text-[11px] transition-colors"
            style={{ color: 'var(--accent)', background: 'var(--bg-elevated)' }}
          >
            + 新对话
          </Link>
          <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
            {recentConversations.length === 0 ? (
              <p className="px-2 py-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                暂无历史，发送消息后自动保存
              </p>
            ) : (
              recentConversations.map(c => {
                const activeConv = c.id === conversationId
                return (
                  <Link
                    key={c.id}
                    href={`/chat/${activeAgentId}/${c.id}`}
                    className="line-clamp-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors"
                    style={{
                      background: activeConv ? 'var(--accent-dim)' : 'transparent',
                      color: activeConv ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {c.title?.trim() || '（无标题）'}
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </aside>

      {/* 右侧 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-[52px] shrink-0 items-center justify-between border-b px-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{agent.emoji}</span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {agent.name}
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {agent.status === 'running' ? '执行中' : '在线'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/agents/${activeAgentId}`}
              className="rounded-md px-2 py-1 text-xs"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
            >
              查看 Skill
            </Link>
            <Link
              href="/tasks"
              className="rounded-md px-2 py-1 text-xs"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
            >
              任务历史
            </Link>
            <Link
              href="/usage"
              className="rounded-md px-2 py-1 text-xs"
              style={{ color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
            >
              Token 用量
            </Link>
          </div>
        </header>

        {flowError && (
          <div className="shrink-0 px-4 pt-2">
            <ErrorBanner message={flowError} onDismiss={() => setFlowError(null)} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && !streaming ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-5xl">{agent.emoji}</div>
              <EmptyState
                icon={MessageSquare}
                title="新对话"
                description={`向 ${agent.name} 提问，或使用下方快捷指令。`}
              />
              <div className="flex w-full max-w-lg flex-col gap-2">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                    style={{
                      borderColor: 'var(--border-default)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <Sparkles className="mr-2 inline size-3.5" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[70%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed"
                    style={
                      m.role === 'user'
                        ? {
                            background: 'var(--accent-dim)',
                            border: '1px solid var(--accent-border)',
                            color: 'var(--text-primary)',
                            borderTopRightRadius: 'var(--radius-sm)',
                          }
                        : {
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-primary)',
                            borderTopLeftRadius: 'var(--radius-sm)',
                          }
                    }
                  >
                    {m.streaming && !m.content ? (
                      <span className="inline-flex gap-0.5">
                        <span className="inline-block size-1.5 animate-typing-dot rounded-full bg-[var(--text-tertiary)]" />
                        <span className="inline-block size-1.5 animate-typing-dot rounded-full bg-[var(--text-tertiary)]" />
                        <span className="inline-block size-1.5 animate-typing-dot rounded-full bg-[var(--text-tertiary)]" />
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    {m.role === 'assistant' && !m.streaming && (m.output_tokens > 0 || m.input_tokens > 0) && (
                      <p
                        className="mt-2 border-t pt-1.5 text-xs font-mono"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
                      >
                        本次 +{m.input_tokens} in / +{m.output_tokens} out
                        {m.cache_read_input_tokens ? ` / cache ${m.cache_read_input_tokens}` : ''} tokens
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div
          className="shrink-0 border-t px-4 py-3"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
        >
          {attachNames.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {attachNames.map(n => (
                <span
                  key={n}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  {n}
                  <button type="button" className="text-[var(--text-tertiary)]" onClick={() => setAttachNames(a => a.filter(x => x !== n))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mx-auto flex max-w-3xl flex-col gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入消息，Shift+Enter 换行"
              rows={3}
              disabled={streaming || pending}
              className="resize-none border-[var(--border-default)] bg-[var(--bg-surface)] text-sm"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xlsx,.xls"
                  className="hidden"
                  onChange={e => {
                    const files = e.target.files
                    if (!files) return
                    setAttachNames(Array.from(files).map(f => f.name))
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs"
                  style={{ color: 'var(--text-tertiary)' }}
                  disabled={streaming}
                >
                  <Paperclip className="size-3.5" strokeWidth={1.5} />
                  附件
                </button>
                <button
                  type="button"
                  onClick={() => setTaskMode(t => !t)}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs"
                  style={{
                    color: taskMode ? 'var(--accent)' : 'var(--text-tertiary)',
                    background: taskMode ? 'var(--accent-dim)' : 'transparent',
                  }}
                  disabled={streaming}
                >
                  <ListTodo className="size-3.5" strokeWidth={1.5} />
                  任务模式
                </button>
              </div>
              <button
                type="button"
                onClick={() => void send()}
                disabled={streaming || !input.trim()}
                className="rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                style={{ background: 'var(--accent)' }}
              >
                {streaming ? '发送中…' : '发送'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
