import { createClient } from '@/lib/supabase/server'
import AgentsView, { type AgentCardRow, type SkillOption } from './agents-view'

export default async function AgentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  let agents: AgentCardRow[] = []
  let skills: SkillOption[] = []
  let listError: string | null = null

  if (!orgId) {
    listError = '未找到组织信息'
  } else {
    const [aRes, sRes] = await Promise.all([
      supabase
        .from('agents')
        .select('id,name,description,emoji,status,is_preset,system_prompt,file_permission,created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true }),
      supabase.from('skills').select('id,name,key,category,description').order('category').order('name'),
    ])

    if (aRes.error) listError = aRes.error.message
    skills = (sRes.data ?? []) as SkillOption[]

    if (!aRes.error && aRes.data) {
      const ids = aRes.data.map(a => a.id)
      const { data: links } = await supabase.from('agent_skills').select('agent_id,skill_id').in('agent_id', ids)
      const countMap = new Map<string, number>()
      for (const l of links ?? []) {
        countMap.set(l.agent_id, (countMap.get(l.agent_id) ?? 0) + 1)
      }
      agents = aRes.data.map(a => ({
        ...a,
        skill_count: countMap.get(a.id) ?? 0,
      })) as AgentCardRow[]
    }
  }

  return <AgentsView initialAgents={agents} skills={skills} listError={listError} />
}
