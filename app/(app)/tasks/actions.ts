'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TaskPriority, TaskStatus } from '@/types'
import { TASK_STATUS_LABEL } from '@/lib/task-ui'

async function getOrgIdForUser() {
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

export async function createTask(input: {
  title: string
  description?: string
  agent_id?: string | null
  priority: TaskPriority
  due_date?: string | null
}) {
  const { supabase, user, orgId } = await getOrgIdForUser()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: orgId,
      creator_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      agent_id: input.agent_id || null,
      priority: input.priority,
      status: 'pending' as TaskStatus,
      due_date: input.due_date || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('task_logs').insert({
    task_id: data.id,
    content: '任务已创建',
    log_type: 'info',
  })

  revalidatePath('/tasks')
  return { ok: true, id: data.id }
}

export async function updateTask(
  taskId: string,
  patch: Partial<{
    title: string
    description: string | null
    agent_id: string | null
    priority: TaskPriority
    status: TaskStatus
    due_date: string | null
  }>
) {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { error: '未登录或缺少组织' }

  const { data: before } = await supabase
    .from('tasks')
    .select('status,agent_id')
    .eq('id', taskId)
    .eq('organization_id', orgId)
    .single()

  const { error } = await supabase
    .from('tasks')
    .update({ ...patch })
    .eq('id', taskId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  const logs: { content: string; log_type: 'info' | 'action' }[] = []
  if (before && patch.status != null && patch.status !== before.status) {
    logs.push({
      content: `状态变更为「${TASK_STATUS_LABEL[patch.status]}」`,
      log_type: 'action',
    })
  }
  if (before && patch.agent_id !== undefined && patch.agent_id !== before.agent_id) {
    logs.push({
      content: patch.agent_id ? '已重新指派 Agent' : '已取消指派 Agent',
      log_type: 'action',
    })
  }
  if (logs.length) {
    await supabase.from('task_logs').insert(logs.map(l => ({ task_id: taskId, ...l })))
  }

  revalidatePath('/tasks')
  return { ok: true }
}

export async function getTaskDetail(taskId: string) {
  const { supabase, orgId } = await getOrgIdForUser()
  if (!orgId) return { error: '未登录', task: null, logs: [], outputs: [] }

  const { data: task, error: tErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('organization_id', orgId)
    .single()

  if (tErr || !task) return { error: tErr?.message ?? '任务不存在', task: null, logs: [], outputs: [] }

  const [{ data: logs }, { data: outputs }, { data: agent }] = await Promise.all([
    supabase.from('task_logs').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    supabase.from('task_outputs').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
    task.agent_id
      ? supabase.from('agents').select('id,name,emoji,description').eq('id', task.agent_id).single()
      : Promise.resolve({ data: null }),
  ])

  return {
    error: null,
    task: { ...task, agent: agent ?? undefined },
    logs: logs ?? [],
    outputs: outputs ?? [],
  }
}
