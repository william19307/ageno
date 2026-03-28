import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { rangeStartISO, type UsageRangeKey } from '@/lib/usage-range'
import { formatTokens } from '@/lib/utils'

const RANGE_LABEL: Record<UsageRangeKey, string> = {
  today: '今日',
  week: '本周',
  month: '本月',
  custom: '自定义',
}

const TYPE_LABEL: Record<string, string> = {
  chat: '对话',
  file: '文件处理',
  background: '后台任务',
}

function parseRange(s: string | undefined): UsageRangeKey {
  if (s === 'today' || s === 'week' || s === 'month' || s === 'custom') return s
  return 'month'
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string }>
}) {
  const { range: rangeParam, from } = await searchParams
  const range = parseRange(rangeParam)
  const start = rangeStartISO(range, from ?? null)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  let listError: string | null = null

  const { data: logs, error: logErr } = orgId
    ? await supabase
        .from('token_usage_logs')
        .select('input_tokens,output_tokens,cost_cny,usage_type,agent_id,created_at')
        .eq('organization_id', orgId)
        .gte('created_at', start)
        .order('created_at', { ascending: false })
        .limit(3000)
    : { data: null, error: null }

  if (logErr) listError = logErr.message

  const { data: agents } = orgId
    ? await supabase.from('agents').select('id,name,emoji').eq('organization_id', orgId)
    : { data: null }

  const agentMap = new Map((agents ?? []).map(a => [a.id, `${a.emoji} ${a.name}`]))

  const rows = logs ?? []
  let totalIn = 0
  let totalOut = 0
  let totalCost = 0
  const byAgent = new Map<string, number>()
  const byType = new Map<string, number>()

  for (const r of rows) {
    totalIn += r.input_tokens
    totalOut += r.output_tokens
    totalCost += r.cost_cny ?? 0
    const aid = r.agent_id ?? 'unknown'
    byAgent.set(aid, (byAgent.get(aid) ?? 0) + r.input_tokens + r.output_tokens)
    const ut = r.usage_type ?? 'chat'
    byType.set(ut, (byType.get(ut) ?? 0) + r.input_tokens + r.output_tokens)
  }

  const totalTok = totalIn + totalOut
  const agentList = [...byAgent.entries()]
    .map(([id, tok]) => ({
      id,
      label: agentMap.get(id) ?? '未指定 Agent',
      tok,
      pct: totalTok > 0 ? Math.round((tok / totalTok) * 100) : 0,
      cost: rows
        .filter(l => (l.agent_id ?? 'unknown') === id)
        .reduce((s, l) => s + (l.cost_cny ?? 0), 0),
    }))
    .sort((a, b) => b.tok - a.tok)

  const typeTotal = [...byType.values()].reduce((a, b) => a + b, 0) || 1
  const typeList = [...byType.entries()].map(([k, tok]) => ({
    key: k,
    label: TYPE_LABEL[k] ?? k,
    tok,
    pct: Math.round((tok / typeTotal) * 100),
  }))

  const displayAgents = agentList
  const displayTypes = typeList
  const cardTotal = totalTok
  const cardIn = totalIn
  const cardOut = totalOut
  const cardCost = totalCost

  return (
    <div className="p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      {listError && (
        <div
          className="mb-4 rounded-md px-3 py-2 text-sm"
          style={{
            background: 'var(--danger-dim)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
          }}
        >
          {listError}
        </div>
      )}

      <h1 className="mb-4 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        用量统计
      </h1>

      <div className="mb-6 flex flex-wrap gap-1 rounded-md p-0.5" style={{ background: 'var(--bg-surface)', width: 'fit-content' }}>
        {(Object.keys(RANGE_LABEL) as UsageRangeKey[]).map(k => (
          <Link
            key={k}
            href={k === 'custom' ? `/usage?range=custom&from=${encodeURIComponent(start)}` : `/usage?range=${k}`}
            className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: range === k ? 'var(--bg-elevated)' : 'transparent',
              color: range === k ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {RANGE_LABEL[k]}
          </Link>
        ))}
      </div>

      {range === 'custom' && (
        <form className="mb-4 flex flex-wrap items-end gap-2 text-xs" action="/usage" method="get">
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-1" style={{ color: 'var(--text-secondary)' }}>
            起始日期
            <input
              type="date"
              name="from"
              defaultValue={from?.slice(0, 10) ?? new Date(start).toISOString().slice(0, 10)}
              className="h-9 rounded-md border px-2"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            />
          </label>
          <button
            type="submit"
            className="h-9 rounded-md px-3 text-xs font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            应用
          </button>
        </form>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '总 Token', value: formatTokens(cardTotal) },
          { label: '输入 Token', value: formatTokens(cardIn) },
          { label: '输出 Token', value: formatTokens(cardOut) },
          { label: '费用估算', value: `¥ ${cardCost.toFixed(2)}` },
        ].map(c => (
          <div
            key={c.label}
            className="rounded-lg p-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <p className="mb-3 text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>
            Agent 消耗分布
          </p>
          <ul className="flex flex-col gap-3">
            {displayAgents.length === 0 ? (
              <li className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                暂无数据
              </li>
            ) : (
              displayAgents.map(a => (
                <li key={a.id} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                      {formatTokens(a.tok)} · ¥{a.cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-default)' }}>
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${a.pct}%`, background: 'var(--accent)' }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
        >
          <p className="mb-3 text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>
            任务类型分布
          </p>
          <ul className="flex flex-col gap-3">
            {displayTypes.length === 0 ? (
              <li className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                暂无数据
              </li>
            ) : (
              displayTypes.map(t => (
                <li key={t.key} className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>{t.label}</span>
                    <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                      {t.pct}% · {formatTokens(t.tok)}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-default)' }}>
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${t.pct}%`, background: 'var(--accent)' }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {rows.length > 0 && (
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
        >
          <p className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wider" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}>
            调用记录（最近 {rows.length} 条）
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                  <th className="px-3 py-2">时间</th>
                  <th className="px-3 py-2">Agent</th>
                  <th className="px-3 py-2">类型</th>
                  <th className="px-3 py-2 font-mono">输入</th>
                  <th className="px-3 py-2 font-mono">输出</th>
                  <th className="px-3 py-2 font-mono">费用</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 80).map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-1.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(r.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {agentMap.get(r.agent_id ?? '') ?? '—'}
                    </td>
                    <td className="px-3 py-1.5">{TYPE_LABEL[r.usage_type] ?? r.usage_type}</td>
                    <td className="px-3 py-1.5 font-mono">{r.input_tokens}</td>
                    <td className="px-3 py-1.5 font-mono">{r.output_tokens}</td>
                    <td className="px-3 py-1.5 font-mono">¥{(r.cost_cny ?? 0).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length === 0 && !listError && (
        <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>
          当前区间暂无调用记录。使用 Agent 对话后将在此汇总 Token 与费用。
        </p>
      )}
    </div>
  )
}
