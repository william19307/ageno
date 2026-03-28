-- ============================================================
-- 013_storage_and_outputs.sql
-- Storage bucket + RLS；任务产出确认标记
-- 对象路径：{organization_id}/{user_id}/{filename}
-- ============================================================

alter table task_outputs
  add column if not exists confirmed boolean not null default false;

comment on column task_outputs.confirmed is '用户是否已确认该产出';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workos-files',
  'workos-files',
  false,
  52428800,
  null
)
on conflict (id) do update set public = excluded.public;

drop policy if exists "workos_files_select" on storage.objects;
drop policy if exists "workos_files_insert" on storage.objects;
drop policy if exists "workos_files_update" on storage.objects;
drop policy if exists "workos_files_delete" on storage.objects;

create policy "workos_files_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'workos-files'
    and split_part(name, '/', 1) = (
      select organization_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "workos_files_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'workos-files'
    and split_part(name, '/', 1) = (
      select organization_id::text from public.profiles where id = auth.uid()
    )
    and split_part(name, '/', 2) = auth.uid()::text
  );

create policy "workos_files_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'workos-files'
    and split_part(name, '/', 1) = (
      select organization_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "workos_files_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'workos-files'
    and split_part(name, '/', 1) = (
      select organization_id::text from public.profiles where id = auth.uid()
    )
  );
