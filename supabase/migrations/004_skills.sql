-- ============================================================
-- 004_skills.sql
-- Skill 能力模块
-- ============================================================

create table if not exists skills (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  key             text not null unique,
  description     text,
  category        text not null
                  check (category in ('legal', 'finance', 'admin', 'customer')),
  prompt_template text,
  is_system       boolean not null default true,
  created_at      timestamptz default now() not null
);

comment on table skills is 'Skill 能力模块（Agent 的原子能力单元）';

-- Agent 与 Skill 多对多关联
create table if not exists agent_skills (
  agent_id  uuid not null references agents(id) on delete cascade,
  skill_id  uuid not null references skills(id) on delete cascade,
  primary key (agent_id, skill_id)
);

-- 插入系统预置 Skill
insert into skills (name, key, description, category) values
  -- 法务类
  ('合同审查',     'contract_review',  '审查合同条款，识别潜在法律风险',  'legal'),
  ('合同起草',     'contract_draft',   '根据需求起草各类标准合同',         'legal'),
  ('催款函生成',   'demand_letter',    '生成专业催款函和欠款提醒函',       'legal'),
  ('法律风险识别', 'risk_scan',        '扫描文件中的法律风险点',           'legal'),
  ('合同台账管理', 'ledger_manage',    '整理和管理合同台账',               'legal'),
  -- 财务类
  ('流水解析',   'cashflow_parse',   '解析银行流水，整理收支明细',         'finance'),
  ('开票提醒',   'invoice_reminder', '跟踪开票状态，发送提醒',             'finance'),
  ('报税准备',   'tax_prepare',      '整理报税所需材料和数据',             'finance'),
  ('费用报告',   'expense_report',   '生成费用报告和分析',                 'finance'),
  -- 行政类
  ('会议记录',   'meeting_notes',    '整理和格式化会议记录',               'admin'),
  ('邮件起草',   'email_draft',      '起草各类商务邮件',                   'admin'),
  ('日程提醒',   'schedule_remind',  '管理日程和发送提醒',                 'admin'),
  ('文件摘要',   'doc_summary',      '提取文件核心内容生成摘要',           'admin'),
  -- 客户类
  ('跟进记录',   'followup_log',     '记录客户跟进情况',                   'customer'),
  ('续费提醒',   'renewal_remind',   '跟踪客户续费节点，发送提醒',         'customer'),
  ('沟通草稿',   'message_draft',    '起草客户沟通内容',                   'customer')
on conflict (key) do nothing;
