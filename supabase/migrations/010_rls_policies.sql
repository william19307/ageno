-- ============================================================
-- 010_rls_policies.sql
-- 行级安全策略（RLS）
-- ============================================================

-- 开启 RLS
alter table organizations         enable row level security;
alter table profiles              enable row level security;
alter table organization_invitations enable row level security;
alter table agents                enable row level security;
alter table agent_skills          enable row level security;
alter table tasks                 enable row level security;
alter table task_logs             enable row level security;
alter table task_attachments      enable row level security;
alter table task_outputs          enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table file_folders          enable row level security;
alter table files                 enable row level security;
alter table file_access_logs      enable row level security;
alter table token_usage_logs      enable row level security;
alter table billing_records       enable row level security;

-- ── 辅助函数：获取当前用户的组织 ID ──
create or replace function auth_org_id()
returns uuid
language sql
stable
security definer
as $$
  select organization_id from profiles where id = auth.uid()
$$;

-- ── organizations ──
drop policy if exists "org_self" on organizations;
create policy "org_self" on organizations
  for all using (id = auth_org_id());

-- ── profiles ──
drop policy if exists "profile_org" on profiles;
create policy "profile_org" on profiles
  for all using (organization_id = auth_org_id());

-- ── organization_invitations ──
drop policy if exists "invitation_org" on organization_invitations;
create policy "invitation_org" on organization_invitations
  for all using (organization_id = auth_org_id());

-- ── agents ──
drop policy if exists "agent_org" on agents;
create policy "agent_org" on agents
  for all using (organization_id = auth_org_id());

-- ── agent_skills ──
drop policy if exists "agent_skill_org" on agent_skills;
create policy "agent_skill_org" on agent_skills
  for all using (
    agent_id in (select id from agents where organization_id = auth_org_id())
  );

-- ── tasks ──
drop policy if exists "task_org" on tasks;
create policy "task_org" on tasks
  for all using (organization_id = auth_org_id());

-- ── task_logs ──
drop policy if exists "task_log_org" on task_logs;
create policy "task_log_org" on task_logs
  for all using (
    task_id in (select id from tasks where organization_id = auth_org_id())
  );

-- ── task_attachments ──
drop policy if exists "task_attachment_org" on task_attachments;
create policy "task_attachment_org" on task_attachments
  for all using (
    task_id in (select id from tasks where organization_id = auth_org_id())
  );

-- ── task_outputs ──
drop policy if exists "task_output_org" on task_outputs;
create policy "task_output_org" on task_outputs
  for all using (
    task_id in (select id from tasks where organization_id = auth_org_id())
  );

-- ── conversations ──
drop policy if exists "conv_org" on conversations;
create policy "conv_org" on conversations
  for all using (organization_id = auth_org_id());

-- ── messages ──
drop policy if exists "msg_conv_org" on messages;
create policy "msg_conv_org" on messages
  for all using (
    conversation_id in (
      select id from conversations where organization_id = auth_org_id()
    )
  );

-- ── file_folders ──
drop policy if exists "folder_org" on file_folders;
create policy "folder_org" on file_folders
  for all using (organization_id = auth_org_id());

-- ── files：私有/共享/公司三级权限 ──
drop policy if exists "file_visibility" on files;
create policy "file_visibility" on files
  for all using (
    organization_id = auth_org_id()
    and (
      permission = 'company'
      or owner_id = auth.uid()
      or auth.uid() = any(shared_with)
    )
  );

-- ── file_access_logs ──
drop policy if exists "file_log_org" on file_access_logs;
create policy "file_log_org" on file_access_logs
  for all using (
    file_id in (select id from files where organization_id = auth_org_id())
  );

-- ── token_usage_logs ──
drop policy if exists "token_log_org" on token_usage_logs;
create policy "token_log_org" on token_usage_logs
  for all using (organization_id = auth_org_id());

-- ── billing_records ──
drop policy if exists "billing_org" on billing_records;
create policy "billing_org" on billing_records
  for all using (organization_id = auth_org_id());

-- billing_plans 和 token_packages 是公开只读数据
alter table billing_plans   enable row level security;
alter table token_packages  enable row level security;
drop policy if exists "billing_plan_read" on billing_plans;
create policy "billing_plan_read" on billing_plans for select using (true);
drop policy if exists "token_pkg_read" on token_packages;
create policy "token_pkg_read" on token_packages for select using (true);
