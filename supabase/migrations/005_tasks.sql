-- ============================================================
-- 005_tasks.sql
-- 工作台任务
-- ============================================================

create table if not exists tasks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  creator_id      uuid references auth.users(id) on delete set null,
  agent_id        uuid references agents(id) on delete set null,
  title           text not null,
  description     text,
  status          text not null default 'pending'
                  check (status in ('pending', 'running', 'awaiting', 'completed', 'needs_attention')),
  priority        text not null default 'medium'
                  check (priority in ('urgent', 'high', 'medium', 'low')),
  due_date        date,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

comment on table tasks is '工作台任务';
comment on column tasks.status is 'pending=待分配, running=执行中, awaiting=待确认, completed=已完成, needs_attention=需介入';
comment on column tasks.priority is 'urgent=紧急, high=高, medium=中, low=低';

-- updated_at 自动更新
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- 任务执行日志（时间轴）
create table if not exists task_logs (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  content    text not null,
  log_type   text not null default 'info'
             check (log_type in ('info', 'action', 'error')),
  created_at timestamptz default now() not null
);

-- 任务附件（用户上传）
create table if not exists task_attachments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  file_name  text not null,
  file_url   text not null,
  file_size  bigint,
  mime_type  text,
  created_at timestamptz default now() not null
);

-- 任务产出文件（Agent 生成）
create table if not exists task_outputs (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  file_name  text not null,
  file_url   text not null,
  file_size  bigint,
  created_at timestamptz default now() not null
);
