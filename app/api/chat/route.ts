import { createClient } from '@/lib/supabase/server'
import { streamChatCompletion, type ChatCompletionMessage } from '@/lib/ai'
import { estimateTokenCostUsdCny } from '@/lib/token-cost'
import { buildFileSpaceSystemAppend, type AgentFileBrief } from '@/lib/files-for-agent'

const MAX_FULL_FILE_INJECT_CHARS = 120_000

export const runtime = 'nodejs'
export const maxDuration = 60

const MINIMAX_MODEL = 'MiniMax-M2.7'

function minimaxChatUrl(): string {
  const base = (process.env.MINIMAX_API_BASE ?? 'https://api.minimax.chat/v1').replace(/\/$/, '')
  return `${base}/text/chatcompletion_v2`
}

async function persistAssistantAndUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    conversationId: string
    orgId: string
    userId: string
    agentId: string
    content: string
    inputTokens: number
    outputTokens: number
    cacheRead: number
  }
) {
  const { error: mErr } = await supabase.from('messages').insert({
    conversation_id: params.conversationId,
    role: 'assistant',
    content: params.content,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cache_read_input_tokens: params.cacheRead,
  })
  if (mErr) return mErr

  const { costUsd, costCny } = estimateTokenCostUsdCny(params.inputTokens, params.outputTokens)

  const { error: tErr } = await supabase.from('token_usage_logs').insert({
    organization_id: params.orgId,
    user_id: params.userId,
    agent_id: params.agentId,
    conversation_id: params.conversationId,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cache_read_input_tokens: params.cacheRead,
    cost_usd: costUsd,
    cost_cny: costCny,
    model: MINIMAX_MODEL,
    usage_type: 'chat',
  })
  return tErr ?? null
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    agentId?: string
    conversationId?: string | null
    message?: string
    attachmentNames?: string[]
    /** 由前端根据助手回复中的文件名匹配；服务端仅返回 RLS 下可见且 content 非空的正文 */
    fullFileIds?: string[]
  } | null

  if (!body?.agentId || !body?.message?.trim()) {
    return new Response(JSON.stringify({ error: '缺少 agentId 或 message' }), { status: 400 })
  }

  const apiKey = process.env.MINIMAX_API_KEY?.trim() ?? ''
  if (!apiKey) {
    return new Response(JSON.stringify({ error: '未配置 MINIMAX_API_KEY' }), { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()

  const orgId = profile?.organization_id
  if (!orgId) {
    return new Response(JSON.stringify({ error: '无组织' }), { status: 403 })
  }

  const { data: agent } = await supabase
    .from('agents')
    .select('id,name,system_prompt')
    .eq('id', body.agentId)
    .eq('organization_id', orgId)
    .single()

  if (!agent) {
    return new Response(JSON.stringify({ error: 'Agent 不存在' }), { status: 404 })
  }

  let conversationId = body.conversationId ?? null

  if (!conversationId) {
    const { data: conv, error: cErr } = await supabase
      .from('conversations')
      .insert({
        organization_id: orgId,
        user_id: user.id,
        agent_id: body.agentId,
        title: body.message.slice(0, 40),
      })
      .select('id')
      .single()

    if (cErr || !conv) {
      return new Response(JSON.stringify({ error: cErr?.message ?? '创建会话失败' }), { status: 500 })
    }
    conversationId = conv.id
  }

  const userContent = [
    body.message.trim(),
    ...(body.attachmentNames?.length ? [`\n[附件: ${body.attachmentNames.join(', ')}]`] : []),
  ].join('')

  const { error: uErr } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userContent,
  })

  if (uErr) {
    return new Response(JSON.stringify({ error: uErr.message }), { status: 500 })
  }

  const { data: agentFileRows } = await supabase
    .from('files')
    .select('id,name,created_at,summary')
    .order('created_at', { ascending: false })

  const fileSpaceBlock = buildFileSpaceSystemAppend((agentFileRows ?? []) as AgentFileBrief[])

  const fullFileIds = [...new Set((body.fullFileIds ?? []).filter((id): id is string => typeof id === 'string'))]
  let fullFileInjection = ''
  if (fullFileIds.length > 0) {
    const { data: fullRows } = await supabase.from('files').select('id,name,content').in('id', fullFileIds)
    const parts: string[] = []
    let budget = MAX_FULL_FILE_INJECT_CHARS
    for (const row of fullRows ?? []) {
      const raw = row.content?.trim()
      if (!raw) continue
      const header = `### ${row.name}\n`
      const room = budget - header.length - 2
      if (room < 200) break
      const chunk = raw.length > room ? raw.slice(0, room) + '\n…（已截断）' : raw
      parts.push(header + chunk)
      budget -= header.length + chunk.length + 2
    }
    if (parts.length > 0) {
      fullFileInjection =
        '\n\n【以下为用户授权文件的全文，请基于正文回答；勿编造未在正文中出现的信息】\n\n' + parts.join('\n\n---\n\n')
    }
  }

  const { data: historyRows } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const baseSystem = agent.system_prompt?.trim() || `你是 ${agent.name}，专业、简洁地用中文回复用户。`
  const system = `${baseSystem}\n\n${fileSpaceBlock}`
  const history = (historyRows ?? []).filter(
    (m): m is { role: 'user' | 'assistant'; content: string } =>
      (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  )

  const historyForModel = history.map((m, i) => {
    if (fullFileInjection && i === history.length - 1 && m.role === 'user') {
      return { role: m.role as 'user' | 'assistant', content: m.content + fullFileInjection }
    }
    return { role: m.role as 'user' | 'assistant', content: m.content }
  })

  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: system },
    ...historyForModel.map(m => ({ role: m.role, content: m.content })),
  ]

  const encoder = new TextEncoder()
  const convId = conversationId!
  const groupId = process.env.MINIMAX_GROUP_ID?.trim() || undefined

  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Conversation-Id': convId,
  } as const

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = ''
      let inputTokens = 0
      let outputTokens = 0
      try {
        const gen = streamChatCompletion({
          url: minimaxChatUrl(),
          apiKey,
          model: MINIMAX_MODEL,
          messages,
          groupId,
          maxTokens: 4096,
        })

        for await (const ev of gen) {
          if (ev.kind === 'text') {
            full += ev.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: ev.text })}\n\n`))
          } else if (ev.kind === 'usage') {
            inputTokens = ev.usage.input_tokens
            outputTokens = ev.usage.output_tokens
          } else if (ev.kind === 'error') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: ev.message })}\n\n`))
            controller.close()
            return
          }
        }

        const err = await persistAssistantAndUsage(supabase, {
          conversationId: convId,
          orgId,
          userId: user.id,
          agentId: body.agentId!,
          content: full,
          inputTokens,
          outputTokens,
          cacheRead: 0,
        })
        if (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`))
        } else {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                usage: {
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  cache_read_input_tokens: 0,
                },
              })}\n\n`
            )
          )
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Stream error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers })
}
