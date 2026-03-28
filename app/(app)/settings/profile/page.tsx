import { createClient } from '@/lib/supabase/server'
import ProfileForm from './profile-form'

export default async function ProfileSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, position, avatar_url')
    .eq('id', user!.id)
    .single()

  return (
    <ProfileForm
      initialName={profile?.name ?? null}
      initialPosition={profile?.position ?? null}
      initialAvatar={profile?.avatar_url ?? null}
      email={user?.email ?? null}
    />
  )
}
