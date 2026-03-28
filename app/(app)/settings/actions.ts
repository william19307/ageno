'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateProfileFields(data: {
  name?: string | null
  position?: string | null
  avatar_url?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const patch: Record<string, string | null> = {}
  if (data.name !== undefined) patch.name = data.name
  if (data.position !== undefined) patch.position = data.position
  if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/settings/profile')
  return { ok: true }
}

export async function updateNotificationPrefs(prefs: {
  notification_task_complete?: boolean
  notification_deadline_remind?: boolean
  notification_daily_home?: boolean
  notification_low_token?: boolean
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const { error } = await supabase.from('profiles').update(prefs).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/settings/notifications')
  return { ok: true }
}

export async function inviteMember(email: string, role: 'admin' | 'member') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).single()
  if (!profile?.organization_id) return { error: '无组织' }
  if (profile.role !== 'admin') return { error: '仅管理员可邀请' }

  const { error } = await supabase.from('organization_invitations').insert({
    organization_id: profile.organization_id,
    email: email.trim(),
    role,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/settings/organization')
  return { ok: true }
}

export async function updateOrganizationName(name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('id', user.id).single()
  if (!profile?.organization_id || profile.role !== 'admin') return { error: '无权限' }

  const { error } = await supabase.from('organizations').update({ name: name.trim() }).eq('id', profile.organization_id)
  if (error) return { error: error.message }
  revalidatePath('/settings/organization')
  return { ok: true }
}
