import { createClient } from '@/lib/supabase/server'
import BillingView from './billing-view'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id

  const [{ data: org, error: oErr }, { data: plans, error: pErr }, { data: packages, error: pkgErr }, { data: records, error: rErr }] =
    await Promise.all([
      orgId
        ? supabase
            .from('organizations')
            .select('plan_type,trial_ends_at,token_used,token_quota')
            .eq('id', orgId)
            .single()
        : { data: null, error: null },
      supabase.from('billing_plans').select('*').order('monthly_price_cny', { ascending: true }),
      supabase.from('token_packages').select('*').order('price_cny', { ascending: true }),
      orgId
        ? supabase
            .from('billing_records')
            .select('id,created_at,description,amount_cny,status')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(20)
        : { data: null, error: null },
    ])

  const listError = oErr?.message ?? pErr?.message ?? pkgErr?.message ?? rErr?.message ?? null

  return (
    <div className="p-6" style={{ background: 'var(--bg-base)', minHeight: 'calc(100vh - 52px)' }}>
      <BillingView
        orgPlan={org?.plan_type ?? 'trial'}
        trialEndsAt={org?.trial_ends_at ?? null}
        tokenUsed={org?.token_used ?? 0}
        tokenQuota={org?.token_quota ?? 1_000_000}
        plans={(plans ?? []) as never}
        packages={(packages ?? []) as never}
        records={(records ?? []) as never}
        listError={listError}
      />
    </div>
  )
}
