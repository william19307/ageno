/**
 * UTF-8 安全 Base64（避免 btoa/atob 的 Latin1 限制）。
 * - decodeBase64 / encodeBase64：文本（含中文）
 * - base64ToUint8Array：PDF/docx 等二进制（仅 atob → 字节，不经 TextDecoder）
 */

const BASE64_ONLY = /^[A-Za-z0-9+/]+=*$/

/** 去除空白后是否像标准 Base64（用于判断 markdown/text 正文是否为 UTF-8 再 Base64 的包一层） */
export function looksLikeStandardBase64(s: string): boolean {
  const t = s.replace(/\s/g, '')
  if (t.length < 16) return false
  if (t.length % 4 === 1) return false
  return BASE64_ONLY.test(t)
}

const B64_CHUNK = 8192

/** Base64（UTF-8 字节）→ 字符串，支持中文 */
export function decodeBase64(base64: string): string {
  const bytes = base64ToUint8Array(base64)
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

/** UTF-8 字符串 → Base64，支持中文（分片，避免超长 String.fromCharCode 参数） */
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK))
  }
  return btoa(binary)
}

/** @deprecated 使用 decodeBase64 */
export const base64ToUtf8String = decodeBase64

/** @deprecated 使用 encodeBase64 */
export const utf8StringToBase64 = encodeBase64

/** Base64 → 原始字节（PDF / docx 等） */
export function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '')
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0))
}
