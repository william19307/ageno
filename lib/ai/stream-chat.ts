/**
 * OpenAI 兼容的聊天补全流式解析（用于 MiniMax chatcompletion_v2 等）。
 */

export type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type StreamChatUsage = {
  input_tokens: number
  output_tokens: number
}

export type StreamChatYield =
  | { kind: 'text'; text: string }
  | { kind: 'usage'; usage: StreamChatUsage }
  | { kind: 'error'; message: string }

function pickUsage(raw: unknown): StreamChatUsage | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const input =
    typeof o.input_tokens === 'number'
      ? o.input_tokens
      : typeof o.prompt_tokens === 'number'
        ? o.prompt_tokens
        : 0
  const output =
    typeof o.output_tokens === 'number'
      ? o.output_tokens
      : typeof o.completion_tokens === 'number'
        ? o.completion_tokens
        : 0
  if (input === 0 && output === 0) return null
  return { input_tokens: input, output_tokens: output }
}

function extractDeltaText(choices: unknown): string {
  if (!Array.isArray(choices) || !choices[0]) return ''
  const c0 = choices[0] as Record<string, unknown>
  const delta = c0.delta as Record<string, unknown> | undefined
  if (!delta) return ''
  const content = delta.content
  if (typeof content === 'string') return content
  if (content == null) return ''
  return String(content)
}

function extractErrorMessage(o: Record<string, unknown>): string | null {
  const err = o.error
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    return typeof m === 'string' ? m : String(m)
  }
  if (typeof o.message === 'string') return o.message
  return null
}

const SSE_BLOCK = /\r?\n\r?\n/

function takeCompleteSsePayloads(buffer: string): { payloads: string[]; rest: string } {
  const payloads: string[] = []
  let rest = buffer
  for (;;) {
    const m = rest.match(SSE_BLOCK)
    if (!m || m.index === undefined) break
    const sep = m.index
    const block = rest.slice(0, sep)
    rest = rest.slice(sep + m[0].length)
    const lines = block.split('\n').filter(l => l.trimStart().startsWith('data:'))
    if (!lines.length) continue
    const payload = lines
      .map(l => {
        const t = l.trimStart()
        return t.slice(5).replace(/^\s/, '')
      })
      .join('\n')
    if (payload.trim() !== '[DONE]') payloads.push(payload)
  }
  return { payloads, rest }
}

export type StreamChatCompletionOptions = {
  url: string
  apiKey: string
  model: string
  messages: ChatCompletionMessage[]
  /** 部分账号需在 body 或 Header 中携带 */
  groupId?: string
  maxTokens?: number
  temperature?: number
  topP?: number
}

/**
 * POST OpenAI 兼容 chat completion（stream: true），产出文本增量与末尾 usage（若上游返回）。
 */
export async function* streamChatCompletion(
  options: StreamChatCompletionOptions
): AsyncGenerator<StreamChatYield> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: true,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.95,
    max_tokens: options.maxTokens ?? 4096,
  }
  if (options.groupId) {
    body.group_id = options.groupId
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  }

  let res: Response
  try {
    res = await fetch(options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (e) {
    yield { kind: 'error', message: e instanceof Error ? e.message : '网络请求失败' }
    return
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    let msg = t || `HTTP ${res.status}`
    try {
      const j = JSON.parse(t) as Record<string, unknown>
      const em = extractErrorMessage(j)
      if (em) msg = em
    } catch {
      /* keep text */
    }
    yield { kind: 'error', message: msg }
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    yield { kind: 'error', message: '响应无正文流' }
    return
  }

  const dec = new TextDecoder()
  let buf = ''
  const ct = res.headers.get('content-type') ?? ''

  if (ct.includes('text/event-stream')) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const { payloads, rest } = takeCompleteSsePayloads(buf)
      buf = rest
      for (const payload of payloads) {
        let o: Record<string, unknown>
        try {
          o = JSON.parse(payload) as Record<string, unknown>
        } catch {
          continue
        }
        const errMsg = extractErrorMessage(o)
        if (errMsg) {
          yield { kind: 'error', message: errMsg }
          return
        }
        const text = extractDeltaText(o.choices)
        if (text) yield { kind: 'text', text }
        const u = pickUsage(o.usage)
        if (u) yield { kind: 'usage', usage: u }
      }
    }
    if (buf.trim()) {
      const { payloads } = takeCompleteSsePayloads(buf + '\n\n')
      for (const payload of payloads) {
        try {
          const o = JSON.parse(payload) as Record<string, unknown>
          const text = extractDeltaText(o.choices)
          if (text) yield { kind: 'text', text }
          const u = pickUsage(o.usage)
          if (u) yield { kind: 'usage', usage: u }
        } catch {
          /* ignore */
        }
      }
    }
    return
  }

  // 非标准 SSE：按行 NDJSON
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.replace(/\r$/, '').trim()
      if (!trimmed) continue
      let o: Record<string, unknown>
      try {
        o = JSON.parse(trimmed) as Record<string, unknown>
      } catch {
        continue
      }
      const errMsg = extractErrorMessage(o)
      if (errMsg) {
        yield { kind: 'error', message: errMsg }
        return
      }
      const text = extractDeltaText(o.choices)
      if (text) yield { kind: 'text', text }
      const u = pickUsage(o.usage)
      if (u) yield { kind: 'usage', usage: u }
    }
  }
}
