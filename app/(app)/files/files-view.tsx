'use client'

import { useEffect, useMemo, useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Folder,
  FolderPlus,
  Upload,
  FileText,
  MoreHorizontal,
  HardDrive,
  Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorBanner } from '@/components/common/error-banner'
import { UploadProgressBar } from '@/components/common/upload-progress-bar'
import {
  Dialog,
  DialogActionPrimary,
  DialogActionSecondary,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  updateFilePermission,
  createFolder,
  registerUploadedFile,
  indexUploadedFile,
  deleteFile,
  renameFile,
  getFileSignedUrl,
  listOrgMembersForShare,
  renameFolder,
  deleteFolder,
} from './actions'

type FileRow = {
  id: string
  name: string
  mime_type: string | null
  file_size: number | null
  updated_at: string
  permission: 'private' | 'shared' | 'company'
  owner_id: string | null
  folder_id: string | null
  storage_key: string
}

type FolderRow = {
  id: string
  name: string
  parent_id: string | null
  is_company_folder: boolean
  owner_id: string | null
}

function formatSize(n: number | null) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function fileTypeLabel(mime: string | null, name: string) {
  if (mime?.includes('pdf') || name.endsWith('.pdf')) return 'PDF'
  if (mime?.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'Word'
  if (mime?.includes('sheet') || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'Excel'
  return '文件'
}

function permBadge(p: string) {
  if (p === 'company') return { t: '公司', c: 'var(--success)', bg: 'var(--success-dim)' }
  if (p === 'shared') return { t: '共享', c: 'var(--accent)', bg: 'var(--accent-dim)' }
  return { t: '私有', c: 'var(--text-secondary)', bg: 'var(--bg-elevated)' }
}

/** Storage key 仅允许安全 ASCII；展示名仍用 file.name 写入数据库 */
function storageObjectFileName(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.')
  const rawExt = lastDot > 0 ? originalName.slice(lastDot + 1) : ''
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toLowerCase() || 'bin'
  return `${Date.now()}_${crypto.randomUUID()}.${ext}`
}

export default function FilesView({
  organizationId,
  userId,
  initialFiles,
  initialFolders,
  listError,
}: {
  organizationId: string
  userId: string
  initialFiles: FileRow[]
  initialFolders: FolderRow[]
  listError: string | null
}) {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabaseBrowser = supabaseRef.current
  const [tab, setTab] = useState<'mine' | 'company'>('mine')
  const [files, setFiles] = useState(initialFiles)
  const [folders, setFolders] = useState(initialFolders)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [uploadName, setUploadName] = useState<string | null>(null)
  const [permOpen, setPermOpen] = useState(false)
  const [permTarget, setPermTarget] = useState<FileRow | null>(null)
  const [permLevel, setPermLevel] = useState<'private' | 'shared' | 'company'>('private')
  const [permShared, setPermShared] = useState<string[]>([])
  const [orgMembers, setOrgMembers] = useState<{ id: string; name: string | null }[]>([])
  const [folderOpen, setFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setFiles(initialFiles)
  }, [initialFiles])

  useEffect(() => {
    setFolders(initialFolders)
  }, [initialFolders])

  useEffect(() => {
    if (!permOpen || !organizationId) return
    listOrgMembersForShare().then(r => {
      if (r.members) setOrgMembers(r.members)
    })
  }, [permOpen, organizationId])

  const breadcrumb = useMemo(() => {
    const parts: { id: string | null; name: string }[] = [{ id: null, name: '根目录' }]
    if (!folderId) return parts
    const chain: FolderRow[] = []
    let cur: string | null = folderId
    while (cur) {
      const f = folders.find(x => x.id === cur)
      if (!f) break
      chain.unshift(f)
      cur = f.parent_id
    }
    return [...parts, ...chain.map(f => ({ id: f.id, name: f.name }))]
  }, [folderId, folders])

  const visibleFiles = useMemo(() => {
    return files.filter(f => {
      if (f.folder_id !== folderId) return false
      if (tab === 'company') return f.permission === 'company'
      return f.owner_id === userId && f.permission !== 'company'
    })
  }, [files, folderId, tab, userId])

  const visibleFolders = useMemo(() => {
    return folders.filter(fd => {
      if (fd.parent_id !== folderId) return false
      if (tab === 'company') return fd.is_company_folder
      return !fd.is_company_folder && (fd.owner_id === userId || fd.owner_id == null)
    })
  }, [folders, folderId, tab, userId])

  async function handleUploadFileList(fileList: FileList | null) {
    if (!fileList?.length || !organizationId) return
    const arr = Array.from(fileList)
    for (const file of arr) {
      setUploadName(file.name)
      setUploadPct(0)
      const objectName = storageObjectFileName(file.name)
      const storageKey = `${organizationId}/${userId}/${objectName}`

      const tick = window.setInterval(() => {
        setUploadPct(p => (p == null ? 0 : Math.min(92, p + 6)))
      }, 180)

      const { error: upErr } = await supabaseBrowser.storage
        .from('workos-files')
        .upload(storageKey, file, { upsert: false })

      window.clearInterval(tick)

      if (upErr) {
        setErr(upErr.message)
        setUploadPct(null)
        setUploadName(null)
        return
      }

      setUploadPct(100)
      const reg = await registerUploadedFile({
        name: file.name,
        storage_key: storageKey,
        file_size: file.size,
        mime_type: file.type || null,
        folder_id: folderId,
        permission: tab === 'company' ? 'company' : 'private',
      })
      if (reg.error || !('fileId' in reg)) {
        setErr(reg.error ?? '注册失败')
        await supabaseBrowser.storage.from('workos-files').remove([storageKey])
        setUploadPct(null)
        setUploadName(null)
        return
      }
      void indexUploadedFile(reg.fileId).then(ir => {
        if (ir.error) console.warn('[indexUploadedFile]', ir.error)
      })
      setUploadPct(null)
      setUploadName(null)
    }
    router.refresh()
  }

  function openPerm(f: FileRow) {
    setPermTarget(f)
    setPermLevel(f.permission)
    setPermShared([])
    setPermOpen(true)
  }

  function savePerm() {
    if (!permTarget) {
      setPermOpen(false)
      return
    }
    startTransition(async () => {
      const r = await updateFilePermission(
        permTarget.id,
        permLevel,
        permLevel === 'shared' ? permShared : []
      )
      if (r.error) setErr(r.error)
      else {
        setFiles(prev =>
          prev.map(x => (x.id === permTarget.id ? { ...x, permission: permLevel } : x))
        )
        setPermOpen(false)
        router.refresh()
      }
    })
  }

  function submitFolder() {
    if (!newFolderName.trim()) return
    startTransition(async () => {
      const r = await createFolder(newFolderName.trim(), folderId, tab === 'company')
      if (r.error) setErr(r.error)
      else {
        setNewFolderName('')
        setFolderOpen(false)
        router.refresh()
      }
    })
  }

  async function openSigned(f: FileRow) {
    const r = await getFileSignedUrl(f.storage_key)
    if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer')
    else setErr(r.error ?? '无法生成链接')
  }

  const empty = visibleFiles.length === 0 && visibleFolders.length === 0

  return (
    <div className="flex h-full min-h-[calc(100vh-52px)] flex-col" style={{ background: 'var(--bg-base)' }}>
      {listError && (
        <div className="sticky top-0 z-20">
          <ErrorBanner message={listError} />
        </div>
      )}
      {err && (
        <div className="sticky top-0 z-20">
          <ErrorBanner message={err} onDismiss={() => setErr(null)} />
        </div>
      )}

      <div className="border-b px-6 pt-4" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="mb-3 flex gap-1 rounded-md p-0.5" style={{ background: 'var(--bg-surface)', width: 'fit-content' }}>
          {(
            [
              ['mine', '我的文件', HardDrive],
              ['company', '公司共享', Building2],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: tab === k ? 'var(--bg-elevated)' : 'transparent',
                color: tab === k ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
            >
              <Icon className="size-3.5" strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <nav className="flex flex-wrap items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {breadcrumb.map((b, i) => (
              <span key={`${b.id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <span style={{ color: 'var(--text-tertiary)' }}>/</span>}
                <button
                  type="button"
                  className="rounded px-1 hover:underline"
                  style={{ color: i === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--accent)' }}
                  onClick={() => setFolderId(b.id)}
                >
                  {b.name}
                </button>
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <label
              className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <Upload className="size-3.5" strokeWidth={1.5} />
              上传
              <input
                type="file"
                className="hidden"
                multiple
                disabled={!organizationId}
                onChange={e => {
                  void handleUploadFileList(e.target.files)
                  e.target.value = ''
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setFolderOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <FolderPlus className="size-3.5" strokeWidth={1.5} />
              新建文件夹
            </button>
          </div>
        </div>
      </div>

      {uploadPct != null && (
        <UploadProgressBar percent={uploadPct} fileName={uploadName ?? undefined} />
      )}

      {empty && !listError ? (
        <EmptyState
          icon={Folder}
          title="还没有文件"
          description="上传合同、表格或文档，方便 Agent 引用。"
          actionLabel="上传第一个文件"
          onAction={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()}
        />
      ) : (
        <div className="px-6 py-4">
          <div
            className="overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--border-default)', background: 'var(--bg-surface)' }}
          >
            <div
              className="grid gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wider"
              style={{
                gridTemplateColumns: '1fr 80px 80px 120px 100px 80px',
                borderBottom: '1px solid var(--border-subtle)',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span>文件名</span>
              <span>类型</span>
              <span>大小</span>
              <span>修改时间</span>
              <span>权限</span>
              <span className="text-right">操作</span>
            </div>
            {visibleFolders.map(fd => (
              <ContextMenu key={fd.id}>
                <ContextMenuTrigger className="grid w-full">
                  <button
                    type="button"
                    onDoubleClick={() => setFolderId(fd.id)}
                    className="grid w-full gap-2 px-3 text-left text-sm transition-colors"
                    style={{
                      gridTemplateColumns: '1fr 80px 80px 120px 100px 80px',
                      height: '36px',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-base)')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Folder className="size-3.5 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
                      {fd.name}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>文件夹</span>
                    <span>—</span>
                    <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      —
                    </span>
                    <span>—</span>
                    <span />
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-[180px]">
                  <ContextMenuItem onClick={() => setFolderId(fd.id)}>打开</ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onClick={() => {
                      const n = window.prompt('新文件夹名', fd.name)
                      if (!n?.trim()) return
                      startTransition(async () => {
                        const r = await renameFolder(fd.id, n.trim())
                        if (r.error) setErr(r.error)
                        else router.refresh()
                      })
                    }}
                  >
                    重命名
                  </ContextMenuItem>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                      if (!window.confirm('确定删除该文件夹？')) return
                      startTransition(async () => {
                        const r = await deleteFolder(fd.id)
                        if (r.error) setErr(r.error)
                        else {
                          if (folderId === fd.id) setFolderId(null)
                          router.refresh()
                        }
                      })
                    }}
                  >
                    删除
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
            {visibleFiles.map(f => {
              const pb = permBadge(f.permission)
              return (
                <ContextMenu key={f.id}>
                  <ContextMenuTrigger className="w-full">
                    <div
                      className="grid w-full gap-2 px-3 text-sm transition-colors"
                      style={{
                        gridTemplateColumns: '1fr 80px 80px 120px 100px 80px',
                        height: '36px',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-base)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}
                    >
                      <span className="flex items-center gap-2 truncate" style={{ color: 'var(--text-primary)' }}>
                        <FileText className="size-3.5 shrink-0" style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
                        {f.name}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{fileTypeLabel(f.mime_type, f.name)}</span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {formatSize(f.file_size)}
                      </span>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(f.updated_at).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span
                        className="w-fit rounded px-1.5 py-0.5 text-xs font-medium"
                        style={{ background: pb.bg, color: pb.c }}
                      >
                        {pb.t}
                      </span>
                      <div className="flex justify-end gap-1">
                        <button type="button" className="rounded p-1" style={{ color: 'var(--text-tertiary)' }}>
                          <MoreHorizontal className="size-4" />
                        </button>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-[200px]">
                    <ContextMenuItem onClick={() => void openSigned(f)}>预览 / 下载</ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        const n = window.prompt('新文件名', f.name)
                        if (!n?.trim()) return
                        startTransition(async () => {
                          const r = await renameFile(f.id, n.trim())
                          if (r.error) setErr(r.error)
                          else router.refresh()
                        })
                      }}
                    >
                      重命名
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => openPerm(f)}>设置权限</ContextMenuItem>
                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => {
                        if (!window.confirm(`确定删除「${f.name}」？`)) return
                        startTransition(async () => {
                          const r = await deleteFile(f.id)
                          if (r.error) setErr(r.error)
                          else router.refresh()
                        })
                      }}
                    >
                      删除
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>设置权限</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                权限级别
              </Label>
              <select
                value={permLevel}
                onChange={e => setPermLevel(e.target.value as typeof permLevel)}
                className="h-9 w-full rounded-md border px-2 text-sm"
                style={{
                  borderColor: 'var(--border-default)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="private">私有（仅本人）</option>
                <option value="shared">共享（指定成员）</option>
                <option value="company">公司（全员可见）</option>
              </select>
            </div>
            {permLevel === 'shared' && (
              <div className="space-y-2">
                <Label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  共享给
                </Label>
                {orgMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={permShared.includes(m.id)}
                      onChange={() =>
                        setPermShared(s => (s.includes(m.id) ? s.filter(x => x !== m.id) : [...s, m.id]))
                      }
                    />
                    {m.name || m.id.slice(0, 8)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogActionSecondary type="button" onClick={() => setPermOpen(false)}>
              取消
            </DialogActionSecondary>
            <DialogActionPrimary type="button" disabled={pending} onClick={savePerm}>
              保存
            </DialogActionPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={folderOpen} onOpenChange={setFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="文件夹名称"
            className="h-9 border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
          <DialogFooter>
            <DialogActionPrimary type="button" disabled={pending} onClick={submitFolder}>
              创建
            </DialogActionPrimary>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
