// ── WorkOS 全局类型定义 ──

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  plan_type: 'trial' | 'opc' | 'team';
  token_quota: number;
  token_used: number;
  trial_ends_at?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  name?: string;
  avatar_url?: string;
  role: 'admin' | 'member';
  position?: string;
  notification_task_complete: boolean;
  notification_deadline_remind: boolean;
  notification_daily_home: boolean;
  notification_low_token: boolean;
  created_at: string;
}

export interface Agent {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  description?: string;
  emoji: string;
  system_prompt?: string;
  is_preset: boolean;
  file_permission: 'owner' | 'company';
  status: 'idle' | 'running' | 'offline';
  created_at: string;
  // 关联数据
  skills?: Skill[];
}

export interface Skill {
  id: string;
  name: string;
  key: string;
  description?: string;
  category: 'legal' | 'finance' | 'admin' | 'customer';
  prompt_template?: string;
  is_system: boolean;
}

export type TaskStatus = 'pending' | 'running' | 'awaiting' | 'completed' | 'needs_attention';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  organization_id: string;
  creator_id: string;
  agent_id?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  created_at: string;
  updated_at: string;
  // 关联数据
  agent?: Agent;
  attachments?: TaskAttachment[];
  outputs?: TaskOutput[];
  logs?: TaskLog[];
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

export interface TaskOutput {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  created_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  content: string;
  log_type: 'info' | 'action' | 'error';
  created_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  user_id: string;
  agent_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  agent?: Agent;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  created_at: string;
}

export type FilePermission = 'private' | 'shared' | 'company';

export interface FileFolder {
  id: string;
  organization_id: string;
  owner_id: string;
  name: string;
  parent_id?: string;
  is_company_folder: boolean;
  created_at: string;
}

export interface File {
  id: string;
  organization_id: string;
  owner_id: string;
  folder_id?: string;
  name: string;
  storage_key: string;
  file_size?: number;
  mime_type?: string;
  permission: FilePermission;
  shared_with?: string[];
  created_at: string;
  updated_at: string;
}

export interface TokenUsageLog {
  id: string;
  organization_id: string;
  user_id: string;
  agent_id?: string;
  conversation_id?: string;
  task_id?: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cost_usd?: number;
  cost_cny?: number;
  model: string;
  usage_type: 'chat' | 'file' | 'background';
  created_at: string;
}

// Token 费用计算
export const TOKEN_PRICE = {
  input_per_million:  3,    // USD
  output_per_million: 15,   // USD
  usd_to_cny:         7.2,
} as const;

export function calcTokenCost(inputTokens: number, outputTokens: number) {
  const costUsd =
    (inputTokens / 1_000_000) * TOKEN_PRICE.input_per_million +
    (outputTokens / 1_000_000) * TOKEN_PRICE.output_per_million;
  const costCny = costUsd * TOKEN_PRICE.usd_to_cny;
  return { costUsd, costCny };
}
