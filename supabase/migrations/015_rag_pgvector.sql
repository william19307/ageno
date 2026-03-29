-- ============================================================
-- 015_rag_pgvector.sql
-- RAG：pgvector + 文件切片表（每文件多行 embedding）
-- files.content 已由 014 提供，此处不重复添加
-- ============================================================

create extension if not exists vector;

create table if not exists file_chunks (
  id              uuid primary key default gen_random_uuid(),
  file_id         uuid not null references files(id) on delete cascade,
  chunk_index     int not null,
  content         text not null,
  embedding       vector(1536) not null,
  created_at      timestamptz default now() not null,
  unique (file_id, chunk_index)
);

comment on table file_chunks is '文件文本切片与向量，用于 RAG（余弦相似度检索）';

create index if not exists file_chunks_file_id_idx on file_chunks (file_id);

-- IVFFlat 余弦距离；数据量很少时仍可用，大量写入后可执行 ANALYZE file_chunks;
create index if not exists file_chunks_embedding_idx
  on file_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table file_chunks enable row level security;

drop policy if exists "file_chunks_select" on file_chunks;
create policy "file_chunks_select" on file_chunks
  for select using (
    exists (
      select 1 from files f
      where f.id = file_chunks.file_id
        and f.organization_id = auth_org_id()
        and (
          f.permission = 'company'
          or f.owner_id = auth.uid()
          or auth.uid() = any (coalesce(f.shared_with, '{}'::uuid[]))
        )
    )
  );

drop policy if exists "file_chunks_owner_write" on file_chunks;
create policy "file_chunks_owner_write" on file_chunks
  for all using (
    exists (
      select 1 from files f
      where f.id = file_chunks.file_id
        and f.organization_id = auth_org_id()
        and f.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from files f
      where f.id = file_chunks.file_id
        and f.organization_id = auth_org_id()
        and f.owner_id = auth.uid()
    )
  );

-- 按余弦距离检索（<=> 为 cosine distance，越小越相似）
create or replace function public.match_file_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  file_id uuid,
  file_name text,
  chunk_content text,
  distance double precision
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  return query
  select
    f.id,
    f.name,
    c.content,
    (c.embedding <=> query_embedding)::double precision
  from file_chunks c
  inner join files f on f.id = c.file_id
  where f.organization_id = (select organization_id from profiles where id = auth.uid())
    and (
      f.permission = 'company'
      or f.owner_id = auth.uid()
      or auth.uid() = any (coalesce(f.shared_with, '{}'::uuid[]))
    )
  order by c.embedding <=> query_embedding
  limit least(coalesce(match_count, 5), 20);
end;
$$;

grant execute on function public.match_file_chunks(vector, int) to authenticated;
