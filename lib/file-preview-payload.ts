import type { FilePreviewPayload } from '@/lib/file-preview-types'
import type { FilePreviewData } from '@/app/(app)/files/actions'
import { mapFileTypeToPreviewKind } from '@/lib/agent-file-tag'
import { decodeBase64, looksLikeStandardBase64 } from '@/lib/base64-utf8'

/** markdown/text 等：若整段为 UTF-8 再 Base64 的包层，则解码为正文（支持中文） */
function decodeTextBodyIfUtf8Base64(body: string): string {
  const t = body.trim()
  if (!looksLikeStandardBase64(t)) return body
  try {
    return decodeBase64(t)
  } catch {
    return body
  }
}

export function agentFileTagToPreviewPayload(tag: {
  name: string
  fileType: string
  body: string
}): FilePreviewPayload {
  const kind = mapFileTypeToPreviewKind(tag.fileType)
  const b64 = tag.body.replace(/\s/g, '')

  if (kind === 'pdf' || kind === 'docx') {
    return {
      title: tag.name,
      mode: kind,
      base64Body: b64,
      source: 'agent',
      saveBase64: b64,
    }
  }
  if (kind === 'spreadsheet') {
    const textBody = decodeTextBodyIfUtf8Base64(tag.body)
    return {
      title: tag.name,
      mode: 'spreadsheet',
      textBody,
      source: 'agent',
      saveUtf8: textBody,
    }
  }
  if (kind === 'text') {
    const textBody = decodeTextBodyIfUtf8Base64(tag.body)
    return {
      title: tag.name,
      mode: 'text',
      textBody,
      source: 'agent',
      saveUtf8: textBody,
    }
  }
  const textBody = decodeTextBodyIfUtf8Base64(tag.body)
  return {
    title: tag.name,
    mode: 'markdown',
    textBody,
    source: 'agent',
    saveUtf8: textBody,
  }
}

export function serverFilePreviewToPayload(data: Extract<FilePreviewData, { ok: true }>): FilePreviewPayload {
  const text = data.textContent ?? ''

  return {
    title: data.name,
    mode: data.mode,
    textBody:
      data.mode === 'markdown' || data.mode === 'spreadsheet' ? text : undefined,
    signedUrl: data.signedUrl ?? undefined,
    source: 'files',
    fileId: data.fileId,
  }
}
