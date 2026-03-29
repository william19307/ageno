import { createClient } from '@/lib/supabase/server'
import { streamChatCompletion, type ChatCompletionMessage } from '@/lib/ai'
import { estimateTokenCostUsdCny } from '@/lib/token-cost'
import { buildFileSpaceSystemAppend, type AgentFileBrief } from '@/lib/files-for-agent'
import { embedTexts } from '@/lib/minimax-embed'
import { buildRagContextPrompt, type RagMatchRow } from '@/lib/rag-prompt'

const MAX_FULL_FILE_INJECT_CHARS = 120_000

/**
 * 仅描述 <file> 语法与编码，不得与【输出规则】矛盾。
 * 长文/报告的正文只能出现在 <file> 内（见 FILE_OUTPUT_RULES）。
 */
const FILE_PREVIEW_SYNTAX =
  '【可预览文件 - 语法】侧栏预览依赖唯一根标签：<file name="文件名含扩展名" type="markdown|text|pdf|docx">…</file>。满足上方【输出规则】时，报告/分析/markdown 全文必须写在标签内；对话里除该标签外仅允许一句短说明（建议≤40字），禁止在标签外写 ## 章节、条款列表、长段落。若须用 Base64 传 UTF-8 文本（含中文），须先 UTF-8 字节再 Base64，禁止对含非 Latin1 的字符串直接 btoa。pdf/docx 标签内为无换行 Base64（文件原始字节）。'

/** 优先级高于 Agent 人设中的排版习惯及【语法】里未冲突部分 */
const FILE_OUTPUT_RULES = `【输出规则 - 最高优先级】
以下规则覆盖「在对话里直接输出长文」的习惯。违反视为错误回复。
当满足以下任一条件时，必须使用单个根标签 <file>…</file> 承载全部正文，禁止把报告/章节/列表铺在对话气泡里（气泡内除 <file> 外合计建议不超过一句约40字）：
- 预计总输出超过约300字
- 报告、合同、分析、方案、总结、评测、调研、计划、说明书类
- 含多个章节、多级标题（# / ## / 一、二、）或分条列举占主要篇幅

正确示例（对话里只有一句 + 一个 file 块）：
「分析已完成，报告已在侧栏打开。」
<file name="报告.md" type="markdown">
# 标题
正文……
</file>

错误示例：先在对话里写「## 一、概述」再接 <file>，或没有 <file> 却输出长文。`

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

  let ragBlock = ''
  try {
    const q = body.message.trim()
    if (q.length > 0) {
      const groupId = process.env.MINIMAX_GROUP_ID?.trim() || undefined
      const [queryVec] = await embedTexts([q], 'query', apiKey, groupId)
      const { data: matches, error: ragErr } = await supabase.rpc('match_file_chunks', {
        query_embedding: queryVec,
        match_count: 5,
      })
      if (!ragErr && Array.isArray(matches) && matches.length > 0) {
        const rows: RagMatchRow[] = matches.map(
          (m: { file_name?: string; chunk_content?: string; distance?: number }) => ({
            file_name: String(m.file_name ?? ''),
            chunk_content: String(m.chunk_content ?? ''),
            distance: typeof m.distance === 'number' ? m.distance : undefined,
          })
        )
        ragBlock = buildRagContextPrompt(rows)
      } else if (ragErr) {
        console.warn('[match_file_chunks]', ragErr.message)
      }
    }
  } catch (e) {
    console.warn('[RAG]', e)
  }

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
  // 输出规则紧接人设，避免被文件列表/RAG 长文淹没；语法说明次之
  const systemParts = [baseSystem, FILE_OUTPUT_RULES, FILE_PREVIEW_SYNTAX, fileSpaceBlock, ragBlock].filter(Boolean)
  const system = systemParts.join('\n\n')
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
