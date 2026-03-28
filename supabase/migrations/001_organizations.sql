-- ============================================================
-- 001_organizations.sql
-- 多租户基础：组织/公司表
-- ============================================================

create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  plan_type     text not null default 'trial'
                check (plan_type in ('trial', 'opc', 'team')),
  token_quota   bigint not null default 1000000,  -- 试用期 100 万
  token_used    bigint not null default 0,
  trial_ends_at timestamptz default (now() + interval '14 days'),
  created_at    timestamptz default now() not null
);

comment on table organizations is '组织/公司（多租户单元）';
comment on column organizations.plan_type is 'trial=试用期, opc=OPC套餐, team=团队套餐';
comment on column organizations.token_quota is '总Token配额';
comment on column organizations.token_used is '已使用Token数（通过触发器自动累加）';
