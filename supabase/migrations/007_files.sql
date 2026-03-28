-- ============================================================
-- 007_files.sql
-- 文件空间
-- ============================================================

create table if not exists file_folders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  owner_id          uuid references auth.users(id) on delete set null,
  name              text not null,
  parent_id         uuid references file_folders(id) on delete cascade,
  is_company_folder boolean not null default false,
  created_at        timestamptz default now() not null
);

comment on table file_folders is '文件夹（支持嵌套）';
comment on column file_folders.is_company_folder is 'true=公司共享文件夹，false=私有文件夹';

create table if not exists files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  folder_id       uuid references file_folders(id) on delete set null,
  name            text not null,
  storage_key     text not null,  -- Supabase Storage 中的对象路径
  file_size       bigint,
  mime_type       text,
  permission      text not null default 'private'
                  check (permission in ('private', 'shared', 'company')),
  shared_with     uuid[] default '{}',  -- 指定共享的用户 ID 列表
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

comment on table files is '文件（存储元数据，实体在 Supabase Storage）';
comment on column files.storage_key is 'Supabase Storage bucket 中的对象路径';
comment on column files.permission is 'private=私有, shared=指定共享, company=全公司可见';

create trigger files_updated_at
  before update on files
  for each row execute function update_updated_at();

-- 文件访问日志（审计）
create table if not exists file_access_logs (
  id         uuid primary key default gen_random_uuid(),
  file_id    uuid not null references files(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  agent_id   uuid references agents(id) on delete set null,
  action     text not null check (action in ('view', 'download', 'edit', 'delete')),
  created_at timestamptz default now() not null
);

-- 创建 Supabase Storage bucket（需要手动在控制台或通过 API 执行）
-- bucket: workos-files（private）
-- bucket: workos-avatars（public）
