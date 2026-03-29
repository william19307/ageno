/** Storage key 仅允许安全 ASCII；展示名仍用原始 file.name */
export function storageObjectFileName(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.')
  const rawExt = lastDot > 0 ? originalName.slice(lastDot + 1) : ''
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase() || 'bin'
  return `${Date.now()}_${crypto.randomUUID()}.${ext}`
}
