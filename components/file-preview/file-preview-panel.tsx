'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import mammoth from 'mammoth'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Download, FolderInput, X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { saveGeneratedFileToSpace } from '@/app/(app)/files/actions'
import type { FilePreviewPayload } from '@/lib/file-preview-types'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

const PreviewPdfPages = dynamic(() => import('./preview-pdf-pages'), {
  ssr: false,
  loading: () => (
    <p className="text-sm px-2 py-4" style={{ color: 'var(--text-tertiary)' }}>
      加载 PDF 组件…
    </p>
  ),
})

export type { FilePreviewPayload }

const B64_CHUNK = 8192

/** Base64 → 原始字节（PDF/docx；不经 UTF-8 当作文本解码） */
function base64ToDecodedBytes(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, '')
  return Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0))
}

/** Base64（UTF-8 字节）→ 字符串，支持中文 */
export function decodeBase64(base64: string): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(base64ToDecodedBytes(base64))
}

/** UTF-8 字符串 → Base64，支持中文（分片，避免超长参数） */
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + B64_CHUNK))
  }
  return btoa(binary)
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

async function downloadFromUrl(filename: string, url: string) {
  const r = await fetch(url)
  const blob = await r.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function FilePreviewPanel({
  open,
  onOpenChange,
  payload,
  folderId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  payload: FilePreviewPayload | null
  /** 保存到文件空间时的目标文件夹 */
  folderId?: string | null
}) {
  const [docxHtml, setDocxHtml] = useState<string | null>(null)
  const [docxErr, setDocxErr] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const pdfFile = useMemo(() => {
    if (!payload) return null
    if (payload.mode !== 'pdf') return null
    if (payload.signedUrl) return payload.signedUrl
    if (payload.base64Body) {
      const u8 = base64ToDecodedBytes(payload.base64Body)
      return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
    }
    return null
  }, [payload])

  useEffect(() => {
    setDocxHtml(null)
    setDocxErr(null)
    setSaveMsg(null)
    if (!payload || payload.mode !== 'docx') return

    let cancelled = false
    ;(async () => {
      try {
        if (payload.signedUrl) {
          const r = await fetch(payload.signedUrl)
          const buf = await r.arrayBuffer()
          if (cancelled) return
          const { value } = await mammoth.convertToHtml({ arrayBuffer: buf })
          if (!cancelled) setDocxHtml(value)
        } else if (payload.base64Body) {
          const u8 = base64ToDecodedBytes(payload.base64Body)
          const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
          const { value } = await mammoth.convertToHtml({ arrayBuffer: ab })
          if (!cancelled) setDocxHtml(value)
        }
      } catch (e) {
        if (!cancelled) setDocxErr(e instanceof Error ? e.message : 'Word 解析失败')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [payload])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !payload) return
    // eslint-disable-next-line no-console -- 调试预览数据结构
    console.log('[FilePreview] payload:', {
      title: payload.title,
      mode: payload.mode,
      textLen: payload.textBody?.length ?? 0,
      hasSignedUrl: !!payload.signedUrl,
      base64Len: payload.base64Body?.length ?? 0,
      source: payload.source,
    })
  }, [payload])

  const handleDownload = useCallback(() => {
    if (!payload) return
    const name = payload.title
    if (payload.mode === 'pdf' || payload.mode === 'docx') {
      if (payload.signedUrl) {
        void downloadFromUrl(name, payload.signedUrl)
        return
      }
      if (payload.base64Body) {
        const u8 = base64ToDecodedBytes(payload.base64Body)
        const mime =
          payload.mode === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
        const blob = new Blob([ab], { type: mime })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        URL.revokeObjectURL(a.href)
        return
      }
    }
    const text = payload.textBody ?? ''
    downloadText(name, text)
  }, [payload])

  const handleSave = useCallback(() => {
    if (!payload || payload.source !== 'agent') return
    setSaveMsg(null)
    startTransition(async () => {
      const r = await saveGeneratedFileToSpace({
        name: payload.title,
        bodyUtf8: payload.saveUtf8,
        bodyBase64: payload.saveBase64,
        folderId: folderId ?? null,
        permission: 'private',
      })
      if ('ok' in r && r.ok) {
        setSaveMsg('已保存到文件空间')
        router.refresh()
      } else setSaveMsg((r as { error?: string }).error ?? '保存失败')
    })
  }, [payload, folderId, router])

  if (!payload) return null

  const showSave = payload.source === 'agent' && !!(payload.saveUtf8 ?? payload.saveBase64)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[400px] max-w-[400px] sm:max-w-[400px] gap-0 border-l p-0 flex flex-col h-[100dvh] max-h-[100dvh] border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      >
        <div
          className="relative flex shrink-0 flex-col gap-2 border-b px-3 py-2.5"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2 z-10 shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="关闭"
          >
            <X className="size-4" />
          </Button>
          <div className="flex items-start justify-between gap-2 pr-10">
            <p className="text-sm font-medium leading-snug break-all" style={{ color: 'var(--text-primary)' }}>
              {payload.title}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {showSave && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 text-xs"
                disabled={pending}
                onClick={() => void handleSave()}
              >
                <FolderInput className="mr-1 size-3.5" />
                保存到文件空间
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={() => void handleDownload()}>
              <Download className="mr-1 size-3.5" />
              下载
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </div>
          {saveMsg && (
            <p className="text-xs" style={{ color: saveMsg.startsWith('已') ? 'var(--success)' : 'var(--danger)' }}>
              {saveMsg}
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
          {payload.mode === 'markdown' && (
            <div className="prose-agent-md">
              {payload.textBody?.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{payload.textBody}</ReactMarkdown>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  （正文为空，请检查 Agent 的 &lt;file&gt; 标签内是否有内容）
                </p>
              )}
            </div>
          )}
          {payload.mode === 'text' && (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {payload.textBody?.trim() ? payload.textBody : '（正文为空）'}
            </pre>
          )}
          {payload.mode === 'spreadsheet' && (
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{payload.textBody ?? '（无文本预览）'}</pre>
          )}
          {payload.mode === 'pdf' && pdfFile && <PreviewPdfPages file={pdfFile} />}
          {payload.mode === 'pdf' && !pdfFile && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              无法加载 PDF（需要有效的签名链接或 Base64 正文）。可尝试「下载」查看。
            </p>
          )}
          {payload.mode === 'docx' && docxErr && (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {docxErr}
            </p>
          )}
          {payload.mode === 'docx' && docxHtml && (
            <div
              className="docx-html space-y-2 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: docxHtml }}
            />
          )}
          {payload.mode === 'docx' && !docxHtml && !docxErr && (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              加载 Word…
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
