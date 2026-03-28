import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import AgentDetailView, { type ConvoPreviewRow, type AgentTokenLogRow } from './agent-detail-view'
import type { SkillOption } from '../agents-view'

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  if (!orgId) notFound()

  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (error || !agent) notFound()

  const monthStart = startOfMonth().toISOString()

  const [
    { data: links },
    { data: allSkills },
    { data: usageAgg },
    { data: convs, error: convErr },
    { data: tokenRows },
  ] = await Promise.all([
    supabase.from('agent_skills').select('skill_id').eq('agent_id', id),
    supabase.from('skills').select('id,name,key,category,description').order('category').order('name'),
    supabase
      .from('token_usage_logs')
      .select('input_tokens,output_tokens,cost_cny')
      .eq('agent_id', id)
      .gte('created_at', monthStart),
    supabase
      .from('conversations')
      .select('id,title,updated_at')
      .eq('agent_id', id)
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('token_usage_logs')
      .select('id,created_at,input_tokens,output_tokens,cost_cny,usage_type')
      .eq('agent_id', id)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const skillIds = new Set((links ?? []).map(l => l.skill_id))
  const skills = (allSkills ?? []) as SkillOption[]
  const monthTokens =
    usageAgg?.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0) ?? 0
  const monthCost = usageAgg?.reduce((s, r) => s + (r.cost_cny ?? 0), 0) ?? 0

  const convList = convs ?? []
  const convIds = convList.map(c => c.id)
  let previewByConv: Record<string, string> = {}
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('conversation_id,content,created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
    for (const m of msgs ?? []) {
      const cid = m.conversation_id as string
      if (!previewByConv[cid] && m.content) {
        previewByConv[cid] = m.content.slice(0, 120) + (m.content.length > 120 ? '…' : '')
      }
    }
  }

  const conversations: ConvoPreviewRow[] = convList.map(c => ({
    id: c.id,
    title: c.title,
    updated_at: c.updated_at,
    preview: previewByConv[c.id] ?? '',
  }))

  const tokenLogs = (tokenRows ?? []) as AgentTokenLogRow[]

  return (
    <div className="p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      <Link
        href="/agents"
        className="mb-4 inline-flex items-center gap-1 text-xs transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.5} />
        返回 Agent 列表
      </Link>

      <AgentDetailView
        agent={{
          id: agent.id,
          name: agent.name,
          description: agent.description,
          emoji: agent.emoji,
          system_prompt: agent.system_prompt,
          file_permission: agent.file_permission as 'owner' | 'company',
          is_preset: agent.is_preset,
          status: agent.status,
          created_at: agent.created_at,
        }}
        skills={skills}
        initialSkillIds={[...skillIds]}
        monthTokens={monthTokens}
        monthCost={monthCost}
        conversations={conversations}
        tokenLogs={tokenLogs}
        listError={convErr?.message ?? null}
      />
    </div>
  )
}
