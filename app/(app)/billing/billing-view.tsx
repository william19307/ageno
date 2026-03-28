'use client'

import { useState } from 'react'
import { formatTokens } from '@/lib/utils'
import {
  Dialog,
  DialogActionPrimary,
  DialogActionSecondary,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorBanner } from '@/components/common/error-banner'
import { EmptyState } from '@/components/common/empty-state'
import { Receipt } from 'lucide-react'

type PlanRow = {
  id: string
  name: string
  monthly_price_cny: number | null
  token_quota: number
  max_preset_agents: number
  max_custom_agents: number
  storage_gb: number
}

type PkgRow = { id: string; name: string; tokens: number; price_cny: number }

type BillRow = {
  id: string
  created_at: string
  description: string | null
  amount_cny: number
  status: string
}

const PLAN_LABEL: Record<string, string> = {
  trial: '试用期',
  opc: 'OPC 套餐',
  team: '团队套餐',
}

export default function BillingView({
  orgPlan,
  trialEndsAt,
  tokenUsed,
  tokenQuota,
  plans,
  packages,
  records,
  listError,
}: {
  orgPlan: string
  trialEndsAt: string | null
  tokenUsed: number
  tokenQuota: number
  plans: PlanRow[]
  packages: PkgRow[]
  records: BillRow[]
  listError: string | null
}) {
  const [buyOpen, setBuyOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [selectedPkg, setSelectedPkg] = useState<PkgRow | null>(null)
  const [payMethod, setPayMethod] = useState<'alipay' | 'wechat'>('alipay')

  const opc = plans.find(p => p.id === 'opc')
  const team = plans.find(p => p.id === 'team')
  const pct = tokenQuota > 0 ? Math.min(100, Math.round((tokenUsed / tokenQuota) * 100)) : 0

  const trialDays =
    trialEndsAt != null
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86400000))
      : 0

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        计费与套餐
      </h1>
      {listError && <ErrorBanner message={listError} />}

      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: 'var(--accent-border)',
          background: 'var(--bg-surface)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-mono" style={{ color: 'var(--text-tertiary)' }}>
              当前套餐
            </p>
            <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {PLAN_LABEL[orgPlan] ?? orgPlan}
              {orgPlan === 'trial' && (
                <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
                  · 剩余约 {trialDays} 天体验
                </span>
              )}
            </p>
            <p className="mt-3 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              已用 {formatTokens(tokenUsed)} / {formatTokens(tokenQuota)} tokens
            </p>
            <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full" style={{ background: 'var(--border-default)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUpgradeOpen(true)}
            className="h-9 rounded-md px-4 text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            升级正式套餐
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[opc, team].map(p => {
          if (!p) return null
          const current = (orgPlan === 'opc' && p.id === 'opc') || (orgPlan === 'team' && p.id === 'team')
          return (
            <div
              key={p.id}
              className="rounded-lg border p-4"
              style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
            >
              <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                {p.name}
              </h3>
              <p className="mt-2 text-2xl font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                ¥{Number(p.monthly_price_cny ?? 0).toFixed(0)}
                <span className="text-sm font-normal" style={{ color: 'var(--text-tertiary)' }}>
                  /月
                </span>
              </p>
              <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <li>· {formatTokens(p.token_quota)} Token / 月</li>
                <li>
                  · 预置 Agent {p.max_preset_agents < 0 ? '不限' : p.max_preset_agents} · 自建{' '}
                  {p.max_custom_agents < 0 ? '不限' : p.max_custom_agents}
                </li>
                <li>· {p.storage_gb} GB 文件空间</li>
              </ul>
              <button
                type="button"
                disabled={current}
                className="mt-4 h-8 w-full rounded-md text-xs font-medium disabled:opacity-50"
                style={{
                  background: current ? 'var(--bg-elevated)' : 'var(--accent)',
                  color: current ? 'var(--text-tertiary)' : '#fff',
                }}
              >
                {current ? '当前套餐' : '升级'}
              </button>
            </div>
          )
        })}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Token 补充包
        </h2>
        <ul
          className="divide-y rounded-lg border"
          style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
        >
          {packages.map(pkg => (
            <li key={pkg.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {pkg.name}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {formatTokens(pkg.tokens)} tokens
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                  ¥{Number(pkg.price_cny).toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPkg(pkg)
                    setBuyOpen(true)
                  }}
                  className="h-8 rounded-md px-3 text-xs font-medium text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  购买
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          账单记录
        </h2>
        {records.length === 0 ? (
          <EmptyState icon={Receipt} title="暂无账单" description="订阅与 Token 包购买记录将显示在这里。" />
        ) : (
          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>
                  <th className="px-3 py-2 text-xs">日期</th>
                  <th className="px-3 py-2 text-xs">描述</th>
                  <th className="px-3 py-2 text-xs">金额</th>
                  <th className="px-3 py-2 text-xs">状态</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(r.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {r.description ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">¥{Number(r.amount_cny).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs">{r.status === 'paid' ? '已支付' : r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                className="text-xs font-medium"
                style={{ color: 'var(--accent)' }}
              >
                下载发票（演示）
              </button>
            </div>
          </div>
        )}
      </section>

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>购买 Token 确认（P12-IA）</DialogTitle>
          </DialogHeader>
          {selectedPkg && (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {selectedPkg.name} · ¥{Number(selectedPkg.price_cny).toFixed(0)}
            </p>
          )}
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={payMethod === 'alipay'}
                onChange={() => setPayMethod('alipay')}
              />
              支付宝
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={payMethod === 'wechat'}
                onChange={() => setPayMethod('wechat')}
              />
              微信支付
            </label>
          </div>
          <DialogFooter>
            <DialogActionSecondary type="button" onClick={() => setBuyOpen(false)}>
              取消
            </DialogActionSecondary>
            <DialogActionPrimary type="button" onClick={() => setBuyOpen(false)}>
              确认支付（Mock）
            </DialogActionPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>升级套餐（P12-IB）</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            正式支付网关接入前，此为占位流程。可选择 OPC ¥99/月 或 团队 ¥299/月。
          </p>
          <DialogFooter>
            <DialogActionPrimary type="button" onClick={() => setUpgradeOpen(false)}>
              知道了
            </DialogActionPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
