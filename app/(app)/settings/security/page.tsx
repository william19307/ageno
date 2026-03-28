import { createClient } from '@/lib/supabase/server'
import SecurityForm from './security-form'

export default async function SecuritySettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  return <SecurityForm email={user.email} />
}
