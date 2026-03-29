import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const MAX_STORED_CONTENT = 500_000

export function makeSummary(text: string, maxLen = 500): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t.length) return '（暂无可提取文本）'
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen) + '…'
}

function truncateStored(s: string): string {
  if (s.length <= MAX_STORED_CONTENT) return s
  return s.slice(0, MAX_STORED_CONTENT) + '\n…（内容过长已截断）'
}

export async function extractFileText(
  buffer: Buffer,
  opts: { mimeType: string | null; fileName: string }
): Promise<{ content: string; summary: string }> {
  const name = opts.fileName.toLowerCase()
  const mime = (opts.mimeType ?? '').toLowerCase()
  let raw = ''

  try {
    if (mime.includes('pdf') || name.endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer })
      try {
        const result = await parser.getText()
        raw = result.text ?? ''
      } finally {
        await parser.destroy()
      }
    } else if (
      mime.includes('wordprocessingml') ||
      mime.includes('msword') ||
      name.endsWith('.docx') ||
      name.endsWith('.doc')
    ) {
      if (name.endsWith('.doc') && !name.endsWith('.docx')) {
        raw = ''
      } else {
        const r = await mammoth.extractRawText({ buffer })
        raw = r.value ?? ''
      }
    } else if (
      mime.includes('spreadsheet') ||
      mime.includes('excel') ||
      name.endsWith('.xlsx') ||
      name.endsWith('.xls')
    ) {
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const parts: string[] = []
      for (const sn of wb.SheetNames) {
        const sheet = wb.Sheets[sn]
        if (!sheet) continue
        parts.push(`[${sn}]\n${XLSX.utils.sheet_to_csv(sheet)}`)
      }
      raw = parts.join('\n\n')
    } else if (
      mime.includes('text/markdown') ||
      mime.includes('text/plain') ||
      name.endsWith('.md') ||
      name.endsWith('.txt') ||
      name.endsWith('.csv')
    ) {
      raw = buffer.toString('utf8')
    }
  } catch {
    raw = ''
  }

  const trimmed = raw.trim()
  const content = trimmed ? truncateStored(trimmed) : ''
  const summary = content
    ? makeSummary(content)
    : '（暂无可提取文本，可能为扫描版 PDF、加密 PDF 或旧版 .doc 等格式）'
  return { content, summary }
}
