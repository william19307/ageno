/**
 * 为已有 content、但尚无 file_chunks 向量的文件补全 RAG 索引。
 *
 * 环境变量（可用 .env.local，见下方加载方式）：
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  （服务端密钥，仅本地/CI 使用，勿提交）
 *   MINIMAX_API_KEY
 *   MINIMAX_GROUP_ID          （可选）
 *
 * 运行：npm run backfill:embeddings
 * 或：  npx dotenv -e .env.local -- npm run backfill:embeddings
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { indexFileRagChunks } from '../lib/file-rag-index'

function loadEnvLocal() {
  const p = resolve(process.cwd(), '.env.local')
  if (!existsSync(p)) return
  const raw = readFileSync(p, 'utf8')
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) process.env[k] = v
  }
}

loadEnvLocal()

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const apiKey = process.env.MINIMAX_API_KEY?.trim()
  const groupId = process.env.MINIMAX_GROUP_ID?.trim() || undefined

  if (!url || !serviceKey) {
    console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!apiKey) {
    console.error('缺少 MINIMAX_API_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: files, error: fErr } = await supabase
    .from('files')
    .select('id, content')
    .not('content', 'is', null)

  if (fErr) {
    console.error('查询 files 失败:', fErr.message)
    process.exit(1)
  }

  const list = (files ?? []).filter(f => f.content && String(f.content).trim().length > 0)
  console.log(`共 ${list.length} 条文件有正文，检查需补向量…`)

  let done = 0
  let skipped = 0
  let failed = 0

  for (const row of list) {
    const { count, error: cErr } = await supabase
      .from('file_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('file_id', row.id)

    if (cErr) {
      console.error('count chunks', row.id, cErr.message)
      failed++
      continue
    }
    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    const r = await indexFileRagChunks(supabase, row.id, String(row.content), apiKey, groupId)
    if ('error' in r) {
      console.error('索引失败', row.id, r.error)
      failed++
    } else {
      done++
      console.log('已索引', row.id)
    }
  }

  console.log(`完成：新建索引 ${done}，跳过(已有切片) ${skipped}，失败 ${failed}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
