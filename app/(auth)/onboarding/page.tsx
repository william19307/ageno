'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle } from 'lucide-react'

const PRESET_AGENTS = [
  { emoji: '⚖️', name: '法务 Agent', desc: '合同审查·起草·风险' },
  { emoji: '💰', name: '财务 Agent', desc: '流水整理·开票·报税' },
  { emoji: '📋', name: '行政 Agent', desc: '日程提醒·会议·邮件' },
  { emoji: '👥', name: '客户跟进 Agent', desc: '跟进记录·续费·沟通' },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('error')
    if (!raw) return
    try {
      setUrlError(decodeURIComponent(raw))
    } catch {
      setUrlError(raw)
    }
  }, [])

  function goHome() {
    router.push('/home')
  }

  function handleFileSelect(file: File) {
    setUploadedFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  async function handleUploadAndContinue() {
    if (!uploadedFile) {
      goHome()
      return
    }
    setUploading(true)
    // TODO: 上传到 Supabase Storage
    await new Promise(r => setTimeout(r, 1000))
    setUploading(false)
    goHome()
  }

  return (
    <div
      className="w-[600px] rounded-xl flex flex-col gap-8"
      style={{
        background: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
        padding: '48px',
      }}
    >
      {urlError && (
        <div
          className="px-3 py-2 rounded-md text-sm"
          style={{
            background: 'var(--danger-dim)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
          }}
        >
          {urlError}
        </div>
      )}

      {/* 顶部：Logo + 步骤条 */}
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <span
            className="text-lg font-bold"
            style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
          >
            W
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
          >
            WorkOS
          </span>
        </div>

        <div className="flex items-center gap-2">
          {[1, 2].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full transition-colors"
                style={{ background: step >= s ? 'var(--accent)' : 'var(--border-default)' }}
              />
              {i < 1 && (
                <div
                  className="w-12 h-px transition-colors"
                  style={{ background: step > s ? 'var(--accent)' : 'var(--border-default)' }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="flex flex-col gap-8 animate-page-enter">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              🎉 欢迎，一切就绪
            </h1>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              你的 OPC 套餐已自动开通，以下 4 个数字员工即刻上岗：
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {PRESET_AGENTS.map(agent => (
              <div
                key={agent.name}
                className="flex flex-col gap-2 rounded-lg p-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <span className="text-2xl">{agent.emoji}</span>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {agent.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {agent.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="h-9 rounded-md text-sm font-medium text-white flex items-center justify-center transition-all"
            style={{ background: 'var(--accent)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
          >
            下一步 →
          </button>

          <button
            type="button"
            onClick={goHome}
            className="text-center text-sm transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            跳过引导，直接进入工作台
          </button>

          <p
            className="text-center"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
          >
            第 1 步，共 2 步
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-6 animate-page-enter">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              上传第一份文件，让 Agent 开始工作
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              把你最近的一份合同或文件上传进来，法务 Agent 会立刻帮你检查风险。
            </p>
          </div>

          <div
            className="rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
            style={{
              height: '160px',
              border: `1px dashed ${dragging ? 'var(--accent)' : 'var(--border-default)'}`,
              background: dragging ? 'var(--accent-dim)' : 'var(--bg-surface)',
            }}
            onDragOver={e => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            {uploadedFile ? (
              <>
                <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {uploadedFile.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  点击重新选择
                </p>
              </>
            ) : (
              <>
                <Upload size={24} style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  拖拽文件到这里，或点击上传
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  支持 PDF / Word
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={goHome}
              className="flex-1 h-9 rounded-md text-sm font-medium transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-default)'
              }}
            >
              跳过
            </button>
            <button
              type="button"
              onClick={handleUploadAndContinue}
              disabled={uploading}
              className="flex-[2] h-9 rounded-md text-sm font-medium text-white transition-all"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={e => {
                if (!uploading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-hover)'
              }}
              onMouseLeave={e => {
                if (!uploading) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
              }}
            >
              {uploading ? '上传中...' : uploadedFile ? '上传并进入工作台' : '暂不上传，进入工作台'}
            </button>
          </div>

          <p
            className="text-center"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}
          >
            第 2 步，共 2 步
          </p>
        </div>
      )}
    </div>
  )
}
