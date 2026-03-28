-- ============================================================
-- 003_agents.sql
-- 数字员工（Agent）
-- ============================================================

create table if not exists agents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  name            text not null,
  description     text,
  emoji           text not null default '🤖',
  system_prompt   text,
  is_preset       boolean not null default false,
  file_permission text not null default 'owner'
                  check (file_permission in ('owner', 'company')),
  status          text not null default 'idle'
                  check (status in ('idle', 'running', 'offline')),
  created_at      timestamptz default now() not null
);

comment on table agents is '数字员工（AI Agent）';
comment on column agents.is_preset is '是否为系统预置 Agent（OPC套餐内置）';
comment on column agents.file_permission is 'owner=只能访问拥有者文件, company=可访问公司共享文件';

-- 注册后自动创建 OPC 套餐预置 Agent
create or replace function create_preset_agents(p_org_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.agents (organization_id, owner_id, name, description, emoji, system_prompt, is_preset, file_permission)
  values
    (p_org_id, p_owner_id, '法务 Agent', '合同审查、合同起草、催款函生成、法律风险识别', '⚖️',
     '你是一名专业的法务助理，擅长合同审查、合同起草、催款函生成和法律风险识别。请始终以专业、严谨的态度处理法律相关事务，并在回复中明确指出潜在风险。',
     true, 'owner'),
    (p_org_id, p_owner_id, '财务 Agent', '流水整理、开票提醒、报税准备、收支概览', '💰',
     '你是一名专业的财务助理，擅长整理财务流水、提醒开票事项、准备报税材料和生成收支概览报告。请确保数据准确，并用清晰的格式呈现财务信息。',
     true, 'owner'),
    (p_org_id, p_owner_id, '行政助理', '日程提醒、会议记录、邮件起草、信息整理', '📋',
     '你是一名高效的行政助理，擅长管理日程、记录会议要点、起草邮件和整理各类信息。请保持简洁、专业的风格，优先处理紧急事项。',
     true, 'owner'),
    (p_org_id, p_owner_id, '客户跟进 Agent', '跟进记录、续费提醒、沟通草稿', '👥',
     '你是一名专业的客户关系助理，擅长记录客户跟进信息、提醒续费时间节点和起草客户沟通内容。请保持友好、专业的语气，关注客户需求。',
     true, 'owner');
end;
$$;
