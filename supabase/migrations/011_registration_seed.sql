-- ============================================================
-- 011_registration_seed.sql
-- 注册触发：组织名默认「我的工作台」+ 预置 Agent + agent_skills
-- ============================================================

create or replace function public.seed_preset_agents_and_skills(p_org_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
begin
  insert into agents (organization_id, owner_id, name, description, emoji, system_prompt, is_preset, file_permission)
  values (
    p_org_id, p_owner_id,
    '法务 Agent',
    '合同审查、合同起草、催款函生成、法律风险识别',
    '⚖️',
    '你是一名专业的法务助理，擅长合同审查、合同起草、催款函生成和法律风险识别。请始终以专业、严谨的态度处理法律相关事务，并在回复中明确指出潜在风险。',
    true,
    'owner'
  )
  returning id into aid;

  insert into agent_skills (agent_id, skill_id)
  select aid, s.id from skills s where s.category = 'legal'
  on conflict (agent_id, skill_id) do nothing;

  insert into agents (organization_id, owner_id, name, description, emoji, system_prompt, is_preset, file_permission)
  values (
    p_org_id, p_owner_id,
    '财务 Agent',
    '流水整理、开票提醒、报税准备、收支概览',
    '💰',
    '你是一名专业的财务助理，擅长整理财务流水、提醒开票事项、准备报税材料和生成收支概览报告。请确保数据准确，并用清晰的格式呈现财务信息。',
    true,
    'owner'
  )
  returning id into aid;

  insert into agent_skills (agent_id, skill_id)
  select aid, s.id from skills s where s.category = 'finance'
  on conflict (agent_id, skill_id) do nothing;

  insert into agents (organization_id, owner_id, name, description, emoji, system_prompt, is_preset, file_permission)
  values (
    p_org_id, p_owner_id,
    '行政 Agent',
    '日程提醒、会议记录、邮件起草、信息整理',
    '📋',
    '你是一名高效的行政助理，擅长管理日程、记录会议要点、起草邮件和整理各类信息。请保持简洁、专业的风格，优先处理紧急事项。',
    true,
    'owner'
  )
  returning id into aid;

  insert into agent_skills (agent_id, skill_id)
  select aid, s.id from skills s where s.category = 'admin'
  on conflict (agent_id, skill_id) do nothing;

  insert into agents (organization_id, owner_id, name, description, emoji, system_prompt, is_preset, file_permission)
  values (
    p_org_id, p_owner_id,
    '客户跟进 Agent',
    '跟进记录、续费提醒、沟通草稿',
    '👥',
    '你是一名专业的客户关系助理，擅长记录客户跟进信息、提醒续费时间节点和起草客户沟通内容。请保持友好、专业的语气，关注客户需求。',
    true,
    'owner'
  )
  returning id into aid;

  insert into agent_skills (agent_id, skill_id)
  select aid, s.id from skills s where s.category = 'customer'
  on conflict (agent_id, skill_id) do nothing;
end;
$$;

comment on function public.seed_preset_agents_and_skills(uuid, uuid) is '为新组织创建 4 个预置 Agent 并写入 agent_skills';

-- 旧名兼容（若脚本或外部仍调用）
create or replace function public.create_preset_agents(p_org_id uuid, p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_preset_agents_and_skills(p_org_id, p_owner_id);
end;
$$;

-- 注册：auth.users 插入后创建 org、profile、预置 Agent + skills
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  org_name text;
  cname text;
begin
  cname := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  org_name := coalesce(cname, '我的工作台');

  insert into public.organizations (name)
  values (org_name)
  returning id into org_id;

  insert into public.profiles (id, organization_id, name, role)
  values (
    new.id,
    org_id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
      split_part(new.email, '@', 1)
    ),
    'admin'
  );

  perform public.seed_preset_agents_and_skills(org_id, new.id);

  return new;
end;
$$;
