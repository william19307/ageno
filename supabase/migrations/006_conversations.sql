-- ============================================================
-- 006_conversations.sql
-- Agent 对话记录
-- ============================================================

create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete cascade,
  title           text,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

-- 消息表
create table if not exists messages (
  id                       uuid primary key default gen_random_uuid(),
  conversation_id          uuid not null references conversations(id) on delete cascade,
  role                     text not null check (role in ('user', 'assistant')),
  content                  text not null,
  -- Token 计量（每条 assistant 消息记录）
  input_tokens             integer not null default 0,
  output_tokens            integer not null default 0,
  cache_read_input_tokens  integer not null default 0,
  created_at               timestamptz default now() not null
);

comment on table messages is 'Agent 对话消息';
comment on column messages.input_tokens is '本次调用的输入 Token 数';
comment on column messages.output_tokens is '本次调用的输出 Token 数';
comment on column messages.cache_read_input_tokens is '命中缓存的 Token 数';

-- 对话更新时间同步
create or replace function update_conversation_updated_at()
returns trigger language plpgsql as $$
begin
  update conversations set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_update_conversation
  after insert on messages
  for each row execute function update_conversation_updated_at();
