import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AgentFileBrief } from '@/lib/files-for-agent'
import ChatView, { type ChatAgentRow, type ChatMessageRow, type ConversationSummary } from './chat-view'

export default async function ChatPage({
  params,
}: {
  params: Promise<{ agentId?: string[] }>
}) {
  const { agentId: segments } = await params
  const seg = segments ?? []
  const slugAgent = seg[0] ?? null
  const slugConv = seg[1] ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  if (!orgId) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--danger)' }}>
        未找到组织信息
      </div>
    )
  }

  const { data: agents } = await supabase
    .from('agents')
    .select('id,name,emoji,description,status')
    .eq('organization_id', orgId)
    .order('name')

  const list = (agents ?? []) as ChatAgentRow[]

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12" style={{ color: 'var(--text-secondary)' }}>
        <p className="text-sm">还没有 Agent，请先在 Agent 管理中创建</p>
      </div>
    )
  }

  const activeId = slugAgent && list.some(a => a.id === slugAgent) ? slugAgent : list[0].id

  if (!slugAgent || slugAgent !== activeId) {
    redirect(slugConv ? `/chat/${activeId}/${slugConv}` : `/chat/${activeId}`)
  }

  const { data: convRows } = await supabase
    .from('conversations')
    .select('id,title,updated_at')
    .eq('organization_id', orgId)
    .eq('user_id', user!.id)
    .eq('agent_id', activeId)
    .order('updated_at', { ascending: false })
    .limit(25)

  const recentConversations = (convRows ?? []) as ConversationSummary[]

  let initialConversationId: string | null = null
  let initialMessages: ChatMessageRow[] = []

  if (slugConv) {
    const { data: convOk } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', slugConv)
      .eq('organization_id', orgId)
      .eq('user_id', user!.id)
      .eq('agent_id', activeId)
      .maybeSingle()

    if (!convOk?.id) {
      redirect(`/chat/${activeId}`)
    }

    initialConversationId = convOk.id
    const { data: msgs } = await supabase
      .from('messages')
      .select('id,role,content,input_tokens,output_tokens,cache_read_input_tokens,created_at')
      .eq('conversation_id', convOk.id)
      .order('created_at', { ascending: true })
    initialMessages = (msgs ?? []) as ChatMessageRow[]
  }

  const { data: agentFileRows } = await supabase
    .from('files')
    .select('id,name,created_at,summary')
    .order('created_at', { ascending: false })

  const agentFiles = (agentFileRows ?? []) as AgentFileBrief[]

  return (
    <ChatView
      agents={list}
      activeAgentId={activeId}
      initialConversationId={initialConversationId}
      initialMessages={initialMessages}
      recentConversations={recentConversations}
      agentFiles={agentFiles}
    />
  )
}
