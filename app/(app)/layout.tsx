import Topbar from '@/components/layout/topbar'
import Sidebar from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 获取 Token 用量
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  let tokenUsed = 0
  let tokenQuota = 1000000

  if (profile?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('token_used, token_quota')
      .eq('id', profile.organization_id)
      .single()

    if (org) {
      tokenUsed = org.token_used
      tokenQuota = org.token_quota
    }
  }

  return (
    <div className="flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      <Topbar tokenUsed={tokenUsed} tokenQuota={tokenQuota} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          className="flex-1 overflow-auto animate-page-enter"
          style={{ background: 'var(--bg-base)' }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
