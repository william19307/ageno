-- ============================================================
-- 002_profiles.sql
-- 用户资料（扩展 Supabase auth.users）
-- ============================================================

create table if not exists profiles (
  id                             uuid primary key references auth.users(id) on delete cascade,
  organization_id                uuid references organizations(id) on delete set null,
  name                           text,
  avatar_url                     text,
  role                           text not null default 'member'
                                 check (role in ('admin', 'member')),
  position                       text,
  -- 通知设置
  notification_task_complete     boolean not null default true,
  notification_deadline_remind   boolean not null default true,
  notification_daily_home        boolean not null default true,
  notification_low_token         boolean not null default true,
  created_at                     timestamptz default now() not null
);

comment on table profiles is '用户资料，扩展 auth.users';
comment on column profiles.role is 'admin=管理员, member=普通成员';

-- 注册时自动创建 profile
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  org_id uuid;
  org_name text;
begin
  -- 从 metadata 获取公司名，没有则用邮箱前缀
  org_name := coalesce(
    new.raw_user_meta_data ->> 'company_name',
    split_part(new.email, '@', 1) || ' 的工作台'
  );

  -- 自动创建组织
  insert into public.organizations (name)
  values (org_name)
  returning id into org_id;

  -- 创建 profile
  insert into public.profiles (id, organization_id, name, role)
  values (
    new.id,
    org_id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    'admin'
  );

  return new;
end;
$$;

-- 绑定触发器（只绑一次）
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 邀请表
create table if not exists organization_invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email           text not null,
  role            text not null default 'member'
                  check (role in ('admin', 'member')),
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  accepted_at     timestamptz,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now() not null
);

comment on table organization_invitations is '成员邀请记录';
