import type { TaskPriority, TaskStatus } from '@/types'

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: '待分配',
  running: '执行中',
  awaiting: '待确认',
  completed: '已完成',
  needs_attention: '需介入',
}

export const TASK_STATUS_ORDER: TaskStatus[] = [
  'pending',
  'running',
  'awaiting',
  'needs_attention',
  'completed',
]

/** 状态圆点 / 徽章颜色（与设计稿一致） */
export function taskStatusColor(status: TaskStatus): {
  dot: string
  badgeBg: string
  badgeText: string
} {
  switch (status) {
    case 'running':
      return { dot: 'var(--accent)', badgeBg: 'var(--accent-dim)', badgeText: 'var(--accent)' }
    case 'awaiting':
      return { dot: 'var(--warning)', badgeBg: 'var(--warning-dim)', badgeText: 'var(--warning)' }
    case 'needs_attention':
      return { dot: 'var(--danger)', badgeBg: 'var(--danger-dim)', badgeText: 'var(--danger)' }
    case 'completed':
      return { dot: 'var(--success)', badgeBg: 'var(--success-dim)', badgeText: 'var(--success)' }
    default:
      return { dot: 'var(--text-tertiary)', badgeBg: 'var(--bg-elevated)', badgeText: 'var(--text-secondary)' }
  }
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
}

export function priorityDotColor(p: TaskPriority): string {
  switch (p) {
    case 'urgent':
      return 'var(--danger)'
    case 'high':
      return 'var(--warning)'
    case 'medium':
      return 'var(--accent)'
    default:
      return 'var(--text-tertiary)'
  }
}
