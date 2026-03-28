import { createClient } from '@/lib/supabase/server'
import TasksView, { type TaskRow, type AgentOption } from './tasks-view'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  let tasks: TaskRow[] = []
  let agents: AgentOption[] = []
  let listError: string | null = null

  if (!orgId) {
    listError = '未找到组织信息，请先完成注册或联系管理员'
  } else {
    const [tRes, aRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('agents')
        .select('id,name,emoji,description')
        .eq('organization_id', orgId)
        .order('name'),
    ])

    if (tRes.error) listError = tRes.error.message
    agents = (aRes.data ?? []) as AgentOption[]
    if (!tRes.error && tRes.data) {
      const agentMap = new Map(agents.map(a => [a.id, a]))
      tasks = tRes.data.map(row => ({
        ...row,
        agent: row.agent_id ? agentMap.get(row.agent_id as string) ?? null : null,
      })) as TaskRow[]
    }
  }

  return <TasksView initialTasks={tasks} agents={agents} listError={listError} />
}
