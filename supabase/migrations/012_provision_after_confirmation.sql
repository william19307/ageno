-- ============================================================
-- 012_provision_after_confirmation.sql
-- 取消「注册即建租户」：改为邮箱确认后由应用调用 provision_new_user()
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 邮箱确认后（或免确认注册后）由已登录用户调用；幂等
create or replace function public.provision_new_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  meta jsonb;
  uemail text;
  org_id uuid;
  org_name text;
  cname text;
  uname text;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(uid::text));

  if exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.organization_id is not null
  ) then
    return;
  end if;

  select u.raw_user_meta_data, u.email
  into meta, uemail
  from auth.users u
  where u.id = uid;

  if uemail is null then
    raise exception 'user_email_missing';
  end if;

  cname := nullif(trim(coalesce(meta ->> 'company_name', '')), '');
  org_name := coalesce(cname, '我的工作台');
  uname := coalesce(
    nullif(trim(coalesce(meta ->> 'name', '')), ''),
    split_part(uemail, '@', 1)
  );

  insert into public.organizations (name)
  values (org_name)
  returning id into org_id;

  if exists (select 1 from public.profiles where id = uid) then
    update public.profiles
    set
      organization_id = org_id,
      name = coalesce(public.profiles.name, uname),
      role = 'admin'
    where id = uid
      and organization_id is null;
  else
    insert into public.profiles (id, organization_id, name, role)
    values (uid, org_id, uname, 'admin');
  end if;

  perform public.seed_preset_agents_and_skills(org_id, uid);
end;
$$;

comment on function public.provision_new_user() is '邮箱确认后创建 org + profile + 预置 Agent；可重复调用';

grant execute on function public.provision_new_user() to authenticated;
