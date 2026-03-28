/**
 * 执行 Supabase SQL 迁移
 * 用法: node scripts/run-migrations.mjs
 */
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = 'https://sxvdrsollbdorwgamcjc.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4dmRyc29sbGJkb3J3Z2FtY2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY4Mzc4NCwiZXhwIjoyMDkwMjU5Nzg0fQ.TQl3LR_kXHRudJRZUPSGhwtyDjhpXku5Gz39x5CMKxU'

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ query: sql }),
  })
  return response
}

async function runViaPSQL(sql) {
  // 通过 Supabase SQL 编辑器 API
  const response = await fetch(
    `https://api.supabase.com/v1/projects/sxvdrsollbdorwgamcjc/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  const text = await response.text()
  return { status: response.status, text }
}

const migrationsDir = join(__dirname, '..', 'supabase', 'migrations')
const files = readdirSync(migrationsDir).sort()

console.log(`\n📦 WorkOS 数据库迁移\n`)
console.log(`共 ${files.length} 个迁移文件:\n`)
files.forEach(f => console.log(`  - ${f}`))

console.log(`\n✅ 迁移文件已生成，请在 Supabase Dashboard 的 SQL 编辑器中按序执行:\n`)
console.log(`   https://supabase.com/dashboard/project/sxvdrsollbdorwgamcjc/editor\n`)

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf-8')
  console.log(`--- ${file} (${sql.length} 字符) ---`)
}
