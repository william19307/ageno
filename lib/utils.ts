import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化 Token 数量
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

// 格式化日期（相对时间）
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

// 格式化金额（CNY）
export function formatCNY(amount: number): string {
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(1)}万`
  return `¥${amount.toFixed(2)}`
}

// 获取文件类型颜色
export function getFileMimeColor(mimeType: string): string {
  if (mimeType?.includes('pdf')) return 'text-danger'
  if (mimeType?.includes('word') || mimeType?.includes('doc')) return 'text-[#4285f4]'
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet') || mimeType?.includes('csv')) return 'text-success'
  if (mimeType?.includes('image')) return 'text-warning'
  return 'text-secondary'
}
