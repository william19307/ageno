-- ============================================================
-- 009_billing.sql
-- 计费（套餐 + Token 包 + 账单）
-- ============================================================

-- 套餐定义（静态数据）
create table if not exists billing_plans (
  id                  text primary key,
  name                text not null,
  monthly_price_cny   numeric(8, 2),
  token_quota         bigint not null,
  max_preset_agents   integer not null default 4,  -- -1 表示不限制
  max_custom_agents   integer not null default 2,
  storage_gb          integer not null default 5,
  description         text
);

insert into billing_plans (id, name, monthly_price_cny, token_quota, max_preset_agents, max_custom_agents, storage_gb, description)
values
  ('trial', '免费试用', 0,   1000000,  4, 1, 1,  '14天免费体验，包含100万Token'),
  ('opc',   'OPC 套餐', 99,  5000000,  4, 2, 5,  '面向一人公司，4个预置Agent，500万Token/月'),
  ('team',  '团队套餐', 299, 20000000, -1, -1, 50, '面向小微团队，不限Agent数量，2000万Token/月')
on conflict (id) do update
  set name = excluded.name,
      monthly_price_cny = excluded.monthly_price_cny,
      token_quota = excluded.token_quota;

-- Token 包（单独购买）
create table if not exists token_packages (
  id          text primary key,
  name        text not null,
  tokens      bigint not null,
  price_cny   numeric(8, 2) not null
);

insert into token_packages (id, name, tokens, price_cny)
values
  ('pkg_1m',  '100万 Token 包',  1000000,   19),
  ('pkg_5m',  '500万 Token 包',  5000000,   79),
  ('pkg_20m', '2000万 Token 包', 20000000, 269)
on conflict (id) do nothing;

-- 账单记录
create table if not exists billing_records (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  amount_cny      numeric(10, 2) not null,
  description     text,
  record_type     text not null default 'subscription'
                  check (record_type in ('subscription', 'token_package')),
  status          text not null default 'pending'
                  check (status in ('pending', 'paid', 'failed')),
  created_at      timestamptz default now() not null
);

comment on table billing_records is '账单记录';
