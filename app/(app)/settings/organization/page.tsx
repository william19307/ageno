import { createClient } from '@/lib/supabase/server'
import OrgSettingsView, { type MemberRow } from './org-settings-view'

export default async function OrganizationSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user!.id)
    .single()

  const orgId = profile?.organization_id
  const isAdmin = profile?.role === 'admin'

  const { data: org, error: oErr } = orgId
    ? await supabase.from('organizations').select('name').eq('id', orgId).single()
    : { data: null, error: null }

  const { data: members, error: mErr } = orgId
    ? await supabase
        .from('profiles')
        .select('id,name,role,created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true })
    : { data: null, error: null }

  const listError = pErr?.message ?? oErr?.message ?? mErr?.message ?? null

  return (
    <OrgSettingsView
      orgName={org?.name ?? '未命名组织'}
      isAdmin={isAdmin}
      members={(members ?? []) as MemberRow[]}
      listError={listError}
    />
  )
}
