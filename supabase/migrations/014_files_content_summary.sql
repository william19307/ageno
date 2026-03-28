-- ============================================================
-- 014_files_content_summary.sql
-- 文件全文与摘要（供 Agent 检索）
-- ============================================================

alter table files
  add column if not exists content text,
  add column if not exists summary text;

comment on column files.content is '从 PDF/Word/Excel 等提取的纯文本';
comment on column files.summary is '供 Agent 感知的短摘要（约 500 字内）';
