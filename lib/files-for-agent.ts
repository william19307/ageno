export type AgentFileBrief = {
  id: string
  name: string
  created_at: string
  summary: string | null
}

function formatUploadDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso.slice(0, 10)
  }
}

/** 追加在 Agent system prompt 末尾 */
export function buildFileSpaceSystemAppend(files: AgentFileBrief[]): string {
  const sorted = [...files].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const n = sorted.length
  if (n === 0) {
    return [
      '【你可以访问的文件空间】',
      '用户当前没有可用的授权文件。',
      '',
      '若用户上传文件后仍看不到列表，请提醒对方在「文件空间」中确认权限（私有 / 共享 / 公司）。',
    ].join('\n')
  }

  const blocks = sorted.map((f, i) => {
    const d = formatUploadDate(f.created_at)
    const sumRaw = (f.summary ?? '（暂无摘要）').replace(/\s+/g, ' ').trim()
    const sum = sumRaw.length > 400 ? sumRaw.slice(0, 400) + '…' : sumRaw
    return `${i + 1}. ${f.name}（${d}上传）\n   摘要：${sum}`
  })

  return [
    '【你可以访问的文件空间】',
    `用户共有 ${n} 份文件，以下是文件列表和摘要：`,
    '',
    ...blocks,
    '',
    '如需某份文件的完整正文才能准确回答，请在回复中写出该文件的完整文件名（与上方列表中的名称完全一致）。用户继续发消息时，系统会自动把对应文件的全文注入上下文。',
  ].join('\n')
}

/** 助手是否表达需要查看某文件正文（与 system 提示中的话术呼应） */
const WANTS_FULL_FILE_RE =
  /需要(?:查看|阅读|获取|您提供|用户提供|进一步)?|请(?:您)?(?:允许|授权)?(?:我)?查看|查看(?:该|此)?文件|完整(?:内容|正文)|全文|原文|该文件|此文件|才能准确|无法仅凭摘要|基于(?:完整|正式)|须(?:结合|参照)(?:完整|正文)/

/** 根据助手回复中的意图关键词 + 完整文件名（与列表一致）推断需注入全文的文件 */
export function findMentionedFileIds(
  assistantText: string,
  files: { id: string; name: string }[]
): string[] {
  if (!assistantText.trim()) return []
  if (!WANTS_FULL_FILE_RE.test(assistantText)) return []
  const found: string[] = []
  const sorted = [...files].sort((a, b) => b.name.length - a.name.length)
  for (const f of sorted) {
    const n = f.name.trim()
    if (n.length < 2) continue
    if (assistantText.includes(n)) found.push(f.id)
  }
  return [...new Set(found)]
}
