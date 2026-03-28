export type UsageRangeKey = 'today' | 'week' | 'month' | 'custom'

export function rangeStartISO(key: UsageRangeKey, customFrom?: string | null): string {
  const now = new Date()
  if (key === 'custom' && customFrom) {
    const d = new Date(customFrom)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  if (key === 'today') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return d.toISOString()
  }
  if (key === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  const d = new Date(now.getFullYear(), now.getMonth(), 1)
  return d.toISOString()
}
