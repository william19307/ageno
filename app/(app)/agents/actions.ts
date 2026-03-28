'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getOrgAndUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, orgId: null as string | null }
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  return { supabase, user, orgId: profile?.organization_id ?? null }
}

export async function createAgent(input: {
  name: string
  description?: string
  system_prompt?: string
  skill_ids: string[]
  file_permission: 'owner' | 'company'
}) {
  const { supabase, user, orgId } = await getOrgAndUser()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data: agent, error } = await supabase
    .from('agents')
    .insert({
      organization_id: orgId,
      owner_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      system_prompt: input.system_prompt?.trim() || null,
      is_preset: false,
      file_permission: input.file_permission,
      emoji: '🤖',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  if (input.skill_ids.length > 0) {
    const rows = input.skill_ids.map(sid => ({ agent_id: agent.id, skill_id: sid }))
    const { error: e2 } = await supabase.from('agent_skills').insert(rows)
    if (e2) return { error: e2.message }
  }

  revalidatePath('/agents')
  revalidatePath(`/agents/${agent.id}`)
  return { ok: true, id: agent.id }
}

export async function updateAgentSkills(agentId: string, skill_ids: string[]) {
  const { supabase, orgId } = await getOrgAndUser()
  if (!orgId) return { error: '未登录' }

  const { error: delErr } = await supabase.from('agent_skills').delete().eq('agent_id', agentId)
  if (delErr) return { error: delErr.message }

  if (skill_ids.length > 0) {
    const rows = skill_ids.map(sid => ({ agent_id: agentId, skill_id: sid }))
    const { error: insErr } = await supabase.from('agent_skills').insert(rows)
    if (insErr) return { error: insErr.message }
  }

  revalidatePath('/agents')
  revalidatePath(`/agents/${agentId}`)
  return { ok: true }
}

export async function updateAgent(
  agentId: string,
  patch: Partial<{
    name: string
    description: string | null
    system_prompt: string | null
    file_permission: 'owner' | 'company'
  }>
) {
  const { supabase, orgId } = await getOrgAndUser()
  if (!orgId) return { error: '未登录' }

  const { error } = await supabase
    .from('agents')
    .update(patch)
    .eq('id', agentId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/agents')
  revalidatePath(`/agents/${agentId}`)
  return { ok: true }
}
