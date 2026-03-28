import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(({ name, value }) => {
    to.cookies.set(name, value)
  })
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const nextRaw = requestUrl.searchParams.get('next') ?? '/onboarding'
  const next = nextRaw.startsWith('/') ? nextRaw : `/${nextRaw}`
  const origin = requestUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('缺少授权参数')}`)
  }

  const cookieStore = await cookies()
  const successRedirect = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successRedirect.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { error: rpcError } = await supabase.rpc('provision_new_user')
    if (rpcError) {
      console.error('provision_new_user', rpcError)
      const fallback = NextResponse.redirect(
        `${origin}/onboarding?error=${encodeURIComponent('账户初始化失败，请刷新页面重试')}`
      )
      copyCookies(successRedirect, fallback)
      return fallback
    }
  }

  return successRedirect
}
