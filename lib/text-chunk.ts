/** 按字符切片（适合中文 PDF/Word），chunkSize 字、overlap 字重叠 */
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const t = text.replace(/\r\n/g, '\n').trim()
  if (!t.length) return []
  if (chunkSize <= overlap) return [t]

  const chunks: string[] = []
  let start = 0
  while (start < t.length) {
    const end = Math.min(start + chunkSize, t.length)
    chunks.push(t.slice(start, end))
    if (end >= t.length) break
    start = end - overlap
    if (start < 0) start = 0
  }
  return chunks
}
