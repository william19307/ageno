import type { SupabaseClient } from '@supabase/supabase-js'
import { chunkText } from '@/lib/text-chunk'
import { embedTexts } from '@/lib/minimax-embed'

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200
/** 单次请求最多条数，避免 body 过大 */
const BATCH = 8

export async function indexFileRagChunks(
  supabase: SupabaseClient,
  fileId: string,
  fullContent: string,
  apiKey: string,
  groupId?: string
): Promise<{ ok: true } | { error: string }> {
  const { error: delErr } = await supabase.from('file_chunks').delete().eq('file_id', fileId)
  if (delErr) return { error: delErr.message }

  const text = fullContent.trim()
  if (!text) return { ok: true }

  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP)
  if (!chunks.length) return { ok: true }

  try {
    const rows: { file_id: string; chunk_index: number; content: string; embedding: string }[] = []

    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH)
      const vectors = await embedTexts(slice, 'document', apiKey, groupId)
      slice.forEach((content, j) => {
        const vec = vectors[j]
        rows.push({
          file_id: fileId,
          chunk_index: i + j,
          content,
          embedding: `[${vec.join(',')}]`,
        })
      })
    }

    const { error: insErr } = await supabase.from('file_chunks').insert(rows)
    if (insErr) return { error: insErr.message }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: msg }
  }
}
