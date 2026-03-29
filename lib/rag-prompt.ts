export type RagMatchRow = {
  file_name: string
  chunk_content: string
  distance?: number
}

const MAX_RAG_CHARS = 12_000

/** 将 top-k 检索结果格式化为 system 补充说明 */
export function buildRagContextPrompt(rows: RagMatchRow[]): string {
  if (!rows.length) return ''

  const blocks: string[] = []
  let used = 0
  for (const r of rows) {
    const header = `[文件名：${r.file_name}]`
    const body = r.chunk_content.trim()
    const piece = `${header}\n${body}\n`
    if (used + piece.length > MAX_RAG_CHARS) {
      const room = MAX_RAG_CHARS - used - header.length - 20
      if (room > 200) {
        blocks.push(`${header}\n${body.slice(0, room)}…\n`)
      }
      break
    }
    blocks.push(piece)
    used += piece.length
  }

  return [
    '【文件空间相关内容】',
    '以下是从你的文件空间中检索到的相关内容：',
    '',
    ...blocks,
    '',
    '请结合以上内容回答用户问题。如果以上内容不足以回答，请告知用户。',
  ].join('\n')
}
