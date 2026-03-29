'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { extractFileText } from '@/lib/file-text-extract'
import { indexFileRagChunks } from '@/lib/file-rag-index'
import { storageObjectFileName } from '@/lib/storage-filename'

async function getOrgContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, orgId: null as string | null }
  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  return { supabase, user, orgId: profile?.organization_id ?? null }
}

export async function listOrgMembersForShare() {
  const { supabase, orgId } = await getOrgContext()
  if (!orgId) return { error: '无组织', members: [] as { id: string; name: string | null }[] }
  const { data, error } = await supabase
    .from('profiles')
    .select('id,name')
    .eq('organization_id', orgId)
    .order('name')
  if (error) return { error: error.message, members: [] }
  return { members: data ?? [] }
}

export async function registerUploadedFile(input: {
  name: string
  storage_key: string
  file_size: number
  mime_type: string | null
  folder_id: string | null
  permission: 'private' | 'shared' | 'company'
}) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data: row, error } = await supabase
    .from('files')
    .insert({
      organization_id: orgId,
      owner_id: user.id,
      folder_id: input.folder_id,
      name: input.name.trim(),
      storage_key: input.storage_key,
      file_size: input.file_size,
      mime_type: input.mime_type,
      permission: input.permission,
    })
    .select('id')
    .single()

  if (error || !row) return { error: error?.message ?? '插入失败' }
  revalidatePath('/files')
  return { ok: true, fileId: row.id }
}

/** 上传成功后解析 PDF/Word/Excel 文本写入 content、summary（仅所有者可触发） */
export async function indexUploadedFile(fileId: string) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data: fileRow, error: fErr } = await supabase
    .from('files')
    .select('id,storage_key,name,mime_type,owner_id,organization_id')
    .eq('id', fileId)
    .eq('organization_id', orgId)
    .single()

  if (fErr || !fileRow) return { error: '文件不存在' }
  if (fileRow.owner_id !== user.id) return { error: '仅所有者可建立索引' }

  const { data: blob, error: dErr } = await supabase.storage.from('workos-files').download(fileRow.storage_key)
  if (dErr || !blob) return { error: dErr?.message ?? '下载失败' }

  const buf = Buffer.from(await blob.arrayBuffer())
  const { content, summary } = await extractFileText(buf, {
    mimeType: fileRow.mime_type,
    fileName: fileRow.name,
  })

  const { error: uErr } = await supabase
    .from('files')
    .update({ content, summary, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('owner_id', user.id)

  if (uErr) return { error: uErr.message }

  const apiKey = process.env.MINIMAX_API_KEY?.trim() ?? ''
  if (apiKey && content.trim()) {
    const groupId = process.env.MINIMAX_GROUP_ID?.trim() || undefined
    const rag = await indexFileRagChunks(supabase, fileId, content, apiKey, groupId)
    if ('error' in rag) {
      console.warn('[indexFileRagChunks]', rag.error)
    }
  }

  revalidatePath('/files')
  return { ok: true }
}

export async function deleteFile(fileId: string) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data: row, error: fErr } = await supabase
    .from('files')
    .select('id,storage_key,owner_id,organization_id')
    .eq('id', fileId)
    .eq('organization_id', orgId)
    .single()

  if (fErr || !row) return { error: '文件不存在' }
  if (row.owner_id !== user.id) return { error: '仅所有者可删除' }

  const { error: rmErr } = await supabase.storage.from('workos-files').remove([row.storage_key])
  if (rmErr) return { error: rmErr.message }

  const { error: dErr } = await supabase.from('files').delete().eq('id', fileId)
  if (dErr) return { error: dErr.message }

  revalidatePath('/files')
  return { ok: true }
}

export async function renameFile(fileId: string, newName: string) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }
  const name = newName.trim()
  if (!name) return { error: '名称不能为空' }

  const { error } = await supabase
    .from('files')
    .update({ name })
    .eq('id', fileId)
    .eq('organization_id', orgId)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/files')
  return { ok: true }
}

export async function getFileSignedUrl(storageKey: string) {
  const { supabase, orgId } = await getOrgContext()
  if (!orgId) return { error: '无组织', url: null as string | null }

  const { data: row } = await supabase
    .from('files')
    .select('storage_key,organization_id')
    .eq('storage_key', storageKey)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!row) return { error: '文件不存在', url: null }

  const { data, error } = await supabase.storage.from('workos-files').createSignedUrl(storageKey, 3600)
  if (error) return { error: error.message, url: null }
  return { url: data.signedUrl }
}

export async function updateFilePermission(
  fileId: string,
  permission: 'private' | 'shared' | 'company',
  sharedWith: string[] | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const { error } = await supabase
    .from('files')
    .update({
      permission,
      shared_with: sharedWith ?? [],
    })
    .eq('id', fileId)

  if (error) return { error: error.message }
  revalidatePath('/files')
  return { ok: true }
}

export async function createFolder(name: string, parentId: string | null, isCompany: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '未登录' }

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single()
  const orgId = profile?.organization_id
  if (!orgId) return { error: '无组织' }

  const { error } = await supabase.from('file_folders').insert({
    organization_id: orgId,
    owner_id: isCompany ? null : user.id,
    name: name.trim(),
    parent_id: parentId,
    is_company_folder: isCompany,
  })

  if (error) return { error: error.message }
  revalidatePath('/files')
  return { ok: true }
}

export async function renameFolder(folderId: string, newName: string) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }
  const name = newName.trim()
  if (!name) return { error: '名称不能为空' }

  const { error } = await supabase
    .from('file_folders')
    .update({ name })
    .eq('id', folderId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }
  revalidatePath('/files')
  return { ok: true }
}

export type FilePreviewData =
  | { error: string }
  | {
      ok: true
      fileId: string
      name: string
      mode: 'markdown' | 'pdf' | 'docx' | 'spreadsheet'
      textContent: string | null
      signedUrl: string | null
    }

/** 文件空间内预览：拉取元数据、正文或签名 URL（受 RLS） */
export async function getFilePreviewData(fileId: string): Promise<FilePreviewData> {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data: row, error } = await supabase
    .from('files')
    .select('id,name,mime_type,storage_key,content')
    .eq('id', fileId)
    .eq('organization_id', orgId)
    .single()

  if (error || !row) return { error: '文件不存在或无权访问' }

  const name = row.name
  const lower = name.toLowerCase()
  const mime = (row.mime_type ?? '').toLowerCase()

  let mode: 'markdown' | 'pdf' | 'docx' | 'spreadsheet' = 'markdown'
  if (lower.endsWith('.pdf') || mime.includes('pdf')) mode = 'pdf'
  else if (lower.endsWith('.docx') || mime.includes('wordprocessingml')) mode = 'docx'
  else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mime.includes('spreadsheet') || mime.includes('excel'))
    mode = 'spreadsheet'
  else if (
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.csv') ||
    mime.includes('text/')
  )
    mode = 'markdown'

  let signedUrl: string | null = null
  if (mode === 'pdf' || mode === 'docx') {
    const { data: su, error: sErr } = await supabase.storage
      .from('workos-files')
      .createSignedUrl(row.storage_key, 3600)
    if (sErr || !su?.signedUrl) return { error: sErr?.message ?? '无法生成预览链接' }
    signedUrl = su.signedUrl
  }

  return {
    ok: true,
    fileId: row.id,
    name: row.name,
    mode,
    textContent: row.content,
    signedUrl,
  }
}

function guessMimeFromFileName(name: string): string {
  const n = name.toLowerCase()
  if (n.endsWith('.md')) return 'text/markdown; charset=utf-8'
  if (n.endsWith('.txt')) return 'text/plain; charset=utf-8'
  if (n.endsWith('.csv')) return 'text/csv; charset=utf-8'
  if (n.endsWith('.pdf')) return 'application/pdf'
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

/** 将 Agent 生成的文件保存到文件空间并触发索引 / RAG */
export async function saveGeneratedFileToSpace(input: {
  name: string
  bodyUtf8?: string
  bodyBase64?: string
  folderId?: string | null
  permission?: 'private' | 'company'
}) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const name = input.name.trim()
  if (!name) return { error: '文件名不能为空' }

  let buffer: Buffer
  if (input.bodyBase64?.trim()) {
    try {
      buffer = Buffer.from(input.bodyBase64.replace(/\s/g, ''), 'base64')
    } catch {
      return { error: 'Base64 解码失败' }
    }
  } else if (input.bodyUtf8 != null) {
    buffer = Buffer.from(input.bodyUtf8, 'utf8')
  } else {
    return { error: '缺少文件内容' }
  }

  if (buffer.length === 0) return { error: '内容为空' }

  const mime = guessMimeFromFileName(name)
  const objectName = storageObjectFileName(name)
  const storageKey = `${orgId}/${user.id}/${objectName}`

  const { error: upErr } = await supabase.storage.from('workos-files').upload(storageKey, buffer, {
    contentType: mime.split(';')[0].trim(),
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  const permission = input.permission ?? 'private'
  const { data: inserted, error: insErr } = await supabase
    .from('files')
    .insert({
      organization_id: orgId,
      owner_id: user.id,
      folder_id: input.folderId ?? null,
      name,
      storage_key: storageKey,
      file_size: buffer.length,
      mime_type: mime.split(';')[0].trim(),
      permission,
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    await supabase.storage.from('workos-files').remove([storageKey])
    return { error: insErr?.message ?? '保存记录失败' }
  }

  const fileId = inserted.id

  const { content, summary } = await extractFileText(buffer, { mimeType: mime.split(';')[0].trim(), fileName: name })
  const { error: upRowErr } = await supabase
    .from('files')
    .update({ content, summary, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('owner_id', user.id)

  if (upRowErr) {
    console.warn('[saveGeneratedFileToSpace] content update', upRowErr.message)
  }

  const apiKey = process.env.MINIMAX_API_KEY?.trim() ?? ''
  if (apiKey && content.trim()) {
    const groupId = process.env.MINIMAX_GROUP_ID?.trim() || undefined
    const rag = await indexFileRagChunks(supabase, fileId, content, apiKey, groupId)
    if ('error' in rag) console.warn('[saveGeneratedFileToSpace RAG]', rag.error)
  }

  revalidatePath('/files')
  return { ok: true, fileId }
}

export async function deleteFolder(folderId: string) {
  const { supabase, user, orgId } = await getOrgContext()
  if (!user || !orgId) return { error: '未登录或缺少组织' }

  const { data: folder } = await supabase
    .from('file_folders')
    .select('id,owner_id,is_company_folder')
    .eq('id', folderId)
    .eq('organization_id', orgId)
    .single()

  if (!folder) return { error: '文件夹不存在' }
  if (folder.is_company_folder || folder.owner_id !== user.id) return { error: '无权限删除' }

  const { count } = await supabase
    .from('files')
    .select('*', { count: 'exact', head: true })
    .eq('folder_id', folderId)

  if ((count ?? 0) > 0) return { error: '请先清空文件夹内文件' }

  const { count: sub } = await supabase
    .from('file_folders')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', folderId)

  if ((sub ?? 0) > 0) return { error: '请先删除子文件夹' }

  const { error } = await supabase.from('file_folders').delete().eq('id', folderId)
  if (error) return { error: error.message }
  revalidatePath('/files')
  return { ok: true }
}
