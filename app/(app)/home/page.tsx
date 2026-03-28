import { createClient } from '@/lib/supabase/server'
import HomeContent, {
  type HomeAgentStatus,
  type HomePendingOutput,
  type HomeRunningTask,
  type HomeUrgentItem,
} from './home-content'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 6) return '深夜好'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

function formatDate() {
  return new Date().toLocaleDateString('zh-CN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatTaskTime(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  const empty = !orgId

  const { data: org } = orgId
    ? await supabase.from('organizations').select('token_used, token_quota').eq('id', orgId).single()
    : { data: null }

  const tokenUsed = org?.token_used ?? 0
  const tokenQuota = org?.token_quota ?? 1
  const tokenWarning = tokenQuota > 0 && tokenUsed / tokenQuota >= 0.85

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: usageLogs } = orgId
    ? await supabase
        .from('token_usage_logs')
        .select('input_tokens, output_tokens, cost_cny')
        .eq('organization_id', orgId)
        .gte('created_at', startOfMonth.toISOString())
    : { data: null }

  const monthTokens =
    usageLogs?.reduce((sum, l) => sum + l.input_tokens + l.output_tokens, 0) ?? 0
  const monthCost = usageLogs?.reduce((sum, l) => sum + Number(l.cost_cny ?? 0), 0) ?? 0

  const { count: taskCount } = orgId
    ? await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString())
    : { count: 0 }

  const userName = profile?.name || user!.email?.split('@')[0] || '用户'

  const dueLimit = new Date()
  dueLimit.setDate(dueLimit.getDate() + 7)
  const dueStr = dueLimit.toISOString().slice(0, 10)

  let urgentItems: HomeUrgentItem[] = []
  let runningTasks: HomeRunningTask[] = []
  let pendingOutputs: HomePendingOutput[] = []
  let agentStatuses: HomeAgentStatus[] = []
  const snapshotRows: { label: string; value: string; sub?: string }[] = []
  let yesterdaySummary = '暂无记录'

  if (orgId) {
    const [{ data: needAtt }, { data: dueSoon }] = await Promise.all([
      supabase
        .from('tasks')
        .select('id,title')
        .eq('organization_id', orgId)
        .eq('status', 'needs_attention')
        .order('updated_at', { ascending: false })
        .limit(8),
      supabase
        .from('tasks')
        .select('id,title,due_date')
        .eq('organization_id', orgId)
        .in('status', ['pending', 'running', 'awaiting', 'needs_attention'])
        .not('due_date', 'is', null)
        .lte('due_date', dueStr)
        .order('due_date', { ascending: true })
        .limit(8),
    ])

    const seen = new Set<string>()
    for (const t of needAtt ?? []) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      urgentItems.push({ id: t.id, text: `【需介入】${t.title}` })
    }
    for (const t of dueSoon ?? []) {
      if (seen.has(t.id)) continue
      seen.add(t.id)
      urgentItems.push({
        id: t.id,
        text: `【即将到期 ${t.due_date}】${t.title}`,
      })
    }

    const { data: runningRows } = await supabase
      .from('tasks')
      .select('id,title,updated_at,agent_id')
      .eq('organization_id', orgId)
      .eq('status', 'running')
      .order('updated_at', { ascending: false })
      .limit(10)

    const agentIds = [...new Set((runningRows ?? []).map(r => r.agent_id).filter(Boolean))] as string[]
    const agentMap = new Map<string, { emoji: string; name: string }>()
    if (agentIds.length) {
      const { data: ag } = await supabase
        .from('agents')
        .select('id,emoji,name')
        .in('id', agentIds)
      for (const a of ag ?? []) agentMap.set(a.id, { emoji: a.emoji, name: a.name })
    }

    runningTasks =
      runningRows?.map(r => {
        const ag = r.agent_id ? agentMap.get(r.agent_id) : null
        return {
          id: r.id,
          agentEmoji: ag?.emoji ?? '🤖',
          agentName: ag?.name ?? 'Agent',
          task: r.title,
          time: formatTaskTime(r.updated_at),
        }
      }) ?? []

    const { data: taskIds } = await supabase.from('tasks').select('id').eq('organization_id', orgId)
    const tids = taskIds?.map(t => t.id) ?? []
    if (tids.length) {
      const { data: outs } = await supabase
        .from('task_outputs')
        .select('id,file_name,task_id')
        .in('task_id', tids)
        .eq('confirmed', false)
        .order('created_at', { ascending: false })
        .limit(10)

      const titleMap = new Map<string, string>()
      const { data: trows } = await supabase.from('tasks').select('id,title').in('id', tids)
      for (const tr of trows ?? []) titleMap.set(tr.id, tr.title)

      pendingOutputs =
        outs?.map(o => ({
          id: o.id,
          text: `${titleMap.get(o.task_id) ?? '任务'} · ${o.file_name}`,
        })) ?? []
    }

    const { data: agents } = await supabase
      .from('agents')
      .select('id,name,emoji,status')
      .eq('organization_id', orgId)
      .order('name')

    agentStatuses =
      agents?.map(a => ({
        id: a.id,
        emoji: a.emoji,
        name: a.name.replace(/ Agent$/, ''),
        status: a.status,
        statusText: a.status === 'running' ? '执行中' : a.status === 'offline' ? '离线' : '空闲',
      })) ?? []

    const { data: pendingBills } = await supabase
      .from('billing_records')
      .select('amount_cny')
      .eq('organization_id', orgId)
      .eq('status', 'pending')

    const pendingCny = pendingBills?.reduce((s, b) => s + Number(b.amount_cny), 0) ?? 0

    const [{ count: nName }, { count: nPdf }] = await Promise.all([
      supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .ilike('name', '%合同%'),
      supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('mime_type', 'application/pdf'),
    ])
    const contractish = (nName ?? 0) + (nPdf ?? 0)

    const { data: custAgents } = await supabase
      .from('agents')
      .select('id')
      .eq('organization_id', orgId)
      .ilike('name', '%客户%')

    const caIds = custAgents?.map(c => c.id) ?? []
    let followCount = 0
    if (caIds.length) {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('agent_id', caIds)
        .in('status', ['pending', 'running', 'awaiting'])
      followCount = count ?? 0
    }

    const { count: contractTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .ilike('title', '%合同%')
      .in('status', ['pending', 'running', 'awaiting', 'needs_attention'])

    snapshotRows.push(
      {
        label: '待收款',
        value: pendingCny >= 10000 ? `¥ ${(pendingCny / 10000).toFixed(1)}万` : `¥ ${pendingCny.toFixed(0)}`,
        sub: '账单 pending',
      },
      {
        label: '合同',
        value: `${(contractish ?? 0) + (contractTasks ?? 0)}`,
        sub: '文件+任务提及',
      },
      {
        label: '客户',
        value: `${followCount}`,
        sub: '跟进中任务',
      }
    )

    const yStart = new Date()
    yStart.setDate(yStart.getDate() - 1)
    yStart.setHours(0, 0, 0, 0)
    const yEnd = new Date(yStart)
    yEnd.setHours(23, 59, 59, 999)

    const { data: yDone } = await supabase
      .from('tasks')
      .select('title')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .gte('updated_at', yStart.toISOString())
      .lte('updated_at', yEnd.toISOString())
      .limit(20)

    if (yDone?.length) {
      yesterdaySummary = `昨日完成 ${yDone.length} 项，含：${yDone
        .slice(0, 3)
        .map(t => t.title)
        .join('、')}${yDone.length > 3 ? '…' : ''}`
    }
  }

  if (empty) {
    snapshotRows.push(
      { label: '待收款', value: '—', sub: '' },
      { label: '合同', value: '—', sub: '' },
      { label: '客户', value: '—', sub: '' }
    )
  }

  return (
    <HomeContent
      userName={userName}
      greeting={getGreeting()}
      dateStr={formatDate()}
      monthTokens={monthTokens}
      monthCost={monthCost}
      taskCount={taskCount ?? 0}
      tokenWarning={tokenWarning}
      tokenUsed={tokenUsed}
      tokenQuota={tokenQuota}
      urgentItems={urgentItems}
      runningTasks={runningTasks}
      pendingOutputs={pendingOutputs}
      agentStatuses={agentStatuses}
      snapshotRows={snapshotRows}
      yesterdaySummary={yesterdaySummary}
    />
  )
}
