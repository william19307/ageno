/** UTF-8 正文 → Base64（含中文）；与 file-preview-panel / lib/base64-utf8 中 encodeBase64 一致。勿使用 btoa(含非 Latin1 的字符串)。 */
export { encodeBase64, utf8StringToBase64 } from '@/lib/base64-utf8'

export type AgentFileTagSegment =
  | { kind: 'text'; value: string }
  | { kind: 'file'; name: string; fileType: string; body: string }

/** 支持 name/type 任意顺序、单双引号、标签内换行；结束标签不区分大小写 */
const FILE_BLOCK_RE = /<file\s+([^>]+?)>([\s\S]*?)<\/file>/gi

function parseFileAttrs(attrStr: string): { name: string; fileType: string } | null {
  const name = attrStr.match(/name\s*=\s*(["'])([^"']*)\1/i)?.[2]?.trim()
  const fileType = attrStr.match(/type\s*=\s*(["'])([^"']*)\1/i)?.[2]?.trim().toLowerCase()
  if (!name || !fileType) return null
  return { name, fileType }
}

/** 将助手消息拆成普通文本与 <file> 块（仅识别已闭合的标签） */
export function splitAgentMessageWithFiles(content: string): AgentFileTagSegment[] {
  if (!content) return []
  const segments: AgentFileTagSegment[] = []
  let lastIndex = 0
  const re = new RegExp(FILE_BLOCK_RE.source, FILE_BLOCK_RE.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const parsed = parseFileAttrs(m[1])
    if (!parsed) continue
    if (m.index > lastIndex) {
      segments.push({ kind: 'text', value: content.slice(lastIndex, m.index) })
    }
    segments.push({
      kind: 'file',
      name: parsed.name,
      fileType: parsed.fileType,
      body: m[2].trimEnd(),
    })
    lastIndex = re.lastIndex
  }
  if (lastIndex < content.length) {
    segments.push({ kind: 'text', value: content.slice(lastIndex) })
  }
  return segments.length ? segments : [{ kind: 'text', value: content }]
}

/** 取出消息中所有已闭合的 file 块（用于流结束后自动预览等） */
export function extractAgentFileTags(content: string): { name: string; fileType: string; body: string }[] {
  const re = new RegExp(FILE_BLOCK_RE.source, FILE_BLOCK_RE.flags)
  const out: { name: string; fileType: string; body: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const parsed = parseFileAttrs(m[1])
    if (!parsed) continue
    out.push({
      name: parsed.name,
      fileType: parsed.fileType,
      body: m[2].trimEnd(),
    })
  }
  return out
}

export function mapFileTypeToPreviewKind(
  t: string
): 'markdown' | 'text' | 'pdf' | 'docx' | 'spreadsheet' | 'unknown' {
  const x = t.toLowerCase()
  if (x === 'markdown' || x === 'md') return 'markdown'
  if (x === 'text' || x === 'plain' || x === 'txt') return 'text'
  if (x === 'pdf') return 'pdf'
  if (x === 'docx' || x === 'word') return 'docx'
  if (x === 'xlsx' || x === 'spreadsheet' || x === 'excel') return 'spreadsheet'
  return 'unknown'
}
