'use client'

import { FileText } from 'lucide-react'
import { splitAgentMessageWithFiles } from '@/lib/agent-file-tag'
import { agentFileTagToPreviewPayload } from '@/lib/file-preview-payload'
import type { FilePreviewPayload } from '@/lib/file-preview-types'

export default function ChatAssistantMessageContent({
  content,
  onPreview,
}: {
  content: string
  onPreview: (p: FilePreviewPayload) => void
}) {
  const segments = splitAgentMessageWithFiles(content)

  return (
    <div className="space-y-2">
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i} className="block whitespace-pre-wrap">
            {seg.value}
          </span>
        ) : (
          <button
            key={i}
            type="button"
            className="flex w-full max-w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors"
            style={{
              borderColor: 'var(--accent-border)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
            }}
            onClick={() => onPreview(agentFileTagToPreviewPayload(seg))}
          >
            <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span className="min-w-0 truncate font-medium">预览：{seg.name}</span>
          </button>
        )
      )}
    </div>
  )
}
