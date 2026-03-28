'use client'

/** STA-04：文件列表上方叠加的上传进度条 */
export function UploadProgressBar({
  percent,
  fileName,
}: {
  percent: number
  fileName?: string
}) {
  return (
    <div
      className="relative z-10 border-b px-4 py-2"
      style={{
        background: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
      data-upload-progress="sta-04"
    >
      <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span>正在上传{fileName ? ` · ${fileName}` : ''}</span>
        <span className="font-mono">{Math.round(percent)}%</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--border-default)' }}>
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out"
          style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
            background: 'var(--accent)',
          }}
        />
      </div>
    </div>
  )
}
