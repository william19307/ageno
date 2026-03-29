export const MINIMAX_EMBED_MODEL = 'embo-01'
export const MINIMAX_EMBED_DIM = 1536

export type MiniMaxEmbedType = 'query' | 'document'

function embeddingsUrl(): string {
  const base = (process.env.MINIMAX_API_BASE ?? 'https://api.minimax.chat/v1').replace(/\/$/, '')
  return `${base}/embeddings`
}

function parseEmbeddingsPayload(raw: unknown): number[][] {
  if (!raw || typeof raw !== 'object') throw new Error('embedding 响应无效')
  const o = raw as Record<string, unknown>

  if (Array.isArray(o.data)) {
    const rows = [...(o.data as { index?: number; embedding?: unknown }[])].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0)
    )
    const out: number[][] = []
    for (const item of rows) {
      if (!item || typeof item !== 'object') continue
      const emb = item.embedding
      if (Array.isArray(emb) && emb.every(x => typeof x === 'number')) {
        out.push(emb as number[])
      }
    }
    if (out.length) return out
  }

  const vectors = o.vectors
  if (Array.isArray(vectors)) {
    const out: number[][] = []
    for (const v of vectors) {
      if (Array.isArray(v) && v.every(x => typeof x === 'number')) out.push(v as number[])
    }
    if (out.length) return out
  }

  const single = o.embedding
  if (Array.isArray(single) && single.every(x => typeof x === 'number')) {
    return [single as number[]]
  }

  throw new Error('无法解析 MiniMax embedding 响应结构')
}

async function embedTextsOnce(
  trimmed: string[],
  type: MiniMaxEmbedType,
  apiKey: string,
  groupId?: string
): Promise<number[][]> {
  const res = await fetch(embeddingsUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MINIMAX_EMBED_MODEL,
      input: trimmed,
      type,
      ...(groupId ? { group_id: groupId } : {}),
    }),
  })

  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) {
    const msg =
      typeof raw?.message === 'string'
        ? raw.message
        : typeof raw?.error === 'string'
          ? raw.error
          : typeof raw?.base_resp === 'object' && raw.base_resp !== null
            ? JSON.stringify((raw.base_resp as { status_msg?: string }).status_msg ?? raw.base_resp)
            : res.statusText
    throw new Error(`MiniMax embedding 失败: ${msg}`)
  }

  const br = raw?.base_resp as { status_code?: number; status_msg?: string } | undefined
  if (br && typeof br.status_code === 'number' && br.status_code !== 0) {
    throw new Error(`MiniMax embedding 失败: ${br.status_msg ?? String(br.status_code)}`)
  }

  const vectors = parseEmbeddingsPayload(raw)
  if (vectors.length !== trimmed.length) {
    throw new Error(`embedding 条数不匹配: 期望 ${trimmed.length}，实际 ${vectors.length}`)
  }
  for (const v of vectors) {
    if (v.length !== MINIMAX_EMBED_DIM) {
      throw new Error(`embedding 维度异常: 期望 ${MINIMAX_EMBED_DIM}，实际 ${v.length}`)
    }
  }
  return vectors
}

/**
 * 调用 MiniMax embedding；input 多条时尽量一次请求（与官方 input 数组一致）。
 * document 类型若接口不支持会自动回退为 query。
 */
export async function embedTexts(
  texts: string[],
  type: MiniMaxEmbedType,
  apiKey: string,
  groupId?: string
): Promise<number[][]> {
  const trimmed = texts.map(t => t.trim()).filter(Boolean)
  if (!trimmed.length) return []

  try {
    return await embedTextsOnce(trimmed, type, apiKey, groupId)
  } catch (e) {
    if (type === 'document') {
      return await embedTextsOnce(trimmed, 'query', apiKey, groupId)
    }
    throw e
  }
}
