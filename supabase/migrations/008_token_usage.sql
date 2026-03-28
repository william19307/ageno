-- ============================================================
-- 008_token_usage.sql
-- Token 使用计量（核心计费表）
-- ============================================================

create table if not exists token_usage_logs (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references organizations(id) on delete cascade,
  user_id                  uuid references auth.users(id) on delete set null,
  agent_id                 uuid references agents(id) on delete set null,
  conversation_id          uuid references conversations(id) on delete set null,
  task_id                  uuid references tasks(id) on delete set null,
  -- Claude API 返回的三类 Token
  input_tokens             integer not null default 0,
  output_tokens            integer not null default 0,
  cache_read_input_tokens  integer not null default 0,
  -- 费用估算（$3/1M input，$15/1M output，×7.2 CNY）
  cost_usd                 numeric(10, 6),
  cost_cny                 numeric(10, 4),
  model                    text not null default 'claude-sonnet-4-20250514',
  usage_type               text not null default 'chat'
                           check (usage_type in ('chat', 'file', 'background')),
  created_at               timestamptz default now() not null
);

comment on table token_usage_logs is 'Token 使用日志（每次 API 调用一条）';
comment on column token_usage_logs.input_tokens is '本次调用输入 Token，含 system prompt';
comment on column token_usage_logs.output_tokens is '本次调用输出 Token';
comment on column token_usage_logs.cache_read_input_tokens is '命中 Prompt Cache 的 Token 数';

-- 写入 token_usage_logs 时，自动累加到 organization.token_used
create or replace function update_org_token_used()
returns trigger
language plpgsql
security definer
as $$
begin
  update organizations
  set token_used = token_used + new.input_tokens + new.output_tokens
  where id = new.organization_id;
  return new;
end;
$$;

drop trigger if exists trg_update_token_used on token_usage_logs;
create trigger trg_update_token_used
  after insert on token_usage_logs
  for each row execute function update_org_token_used();

-- 辅助函数：记录一次 Token 使用（供 API route 调用）
create or replace function log_token_usage(
  p_org_id          uuid,
  p_user_id         uuid,
  p_agent_id        uuid,
  p_conversation_id uuid,
  p_task_id         uuid,
  p_input_tokens    integer,
  p_output_tokens   integer,
  p_cache_tokens    integer,
  p_model           text default 'claude-sonnet-4-20250514',
  p_usage_type      text default 'chat'
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_cost_usd numeric(10,6);
  v_cost_cny numeric(10,4);
  v_log_id   uuid;
begin
  -- 计算费用：input $3/1M，output $15/1M，×7.2 CNY
  v_cost_usd := (p_input_tokens::numeric / 1000000 * 3) +
                (p_output_tokens::numeric / 1000000 * 15);
  v_cost_cny := v_cost_usd * 7.2;

  insert into token_usage_logs (
    organization_id, user_id, agent_id, conversation_id, task_id,
    input_tokens, output_tokens, cache_read_input_tokens,
    cost_usd, cost_cny, model, usage_type
  ) values (
    p_org_id, p_user_id, p_agent_id, p_conversation_id, p_task_id,
    p_input_tokens, p_output_tokens, p_cache_tokens,
    v_cost_usd, v_cost_cny, p_model, p_usage_type
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;
