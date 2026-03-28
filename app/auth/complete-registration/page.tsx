import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * 本地开发关闭「邮箱确认」时，signUp 会直接返回 session，无法走 /auth/callback。
 * 注册成功后跳转到此页，完成与邮件确认后相同的 provision。
 */
export default async function CompleteRegistrationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.rpc('provision_new_user')
  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent('账户初始化失败，请刷新重试')}`)
  }

  redirect('/onboarding')
}
