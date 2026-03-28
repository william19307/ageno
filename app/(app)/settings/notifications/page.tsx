import { createClient } from '@/lib/supabase/server'
import NotificationsForm from './notifications-form'

export default async function NotificationsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'notification_task_complete, notification_deadline_remind, notification_daily_home, notification_low_token'
    )
    .eq('id', user!.id)
    .single()

  return (
    <NotificationsForm
      initial={{
        notification_task_complete: profile?.notification_task_complete ?? true,
        notification_deadline_remind: profile?.notification_deadline_remind ?? true,
        notification_daily_home: profile?.notification_daily_home ?? true,
        notification_low_token: profile?.notification_low_token ?? true,
      }}
    />
  )
}
