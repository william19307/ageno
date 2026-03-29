'use client'

import { useCallback, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function PreviewPdfPages({ file }: { file: string | ArrayBuffer }) {
  const [numPages, setNumPages] = useState(0)
  const onLoad = useCallback(({ numPages: n }: { numPages: number }) => setNumPages(n), [])

  return (
    <Document
      file={file}
      onLoadSuccess={onLoad}
      loading={
        <p className="text-sm px-2 py-4" style={{ color: 'var(--text-tertiary)' }}>
          加载 PDF…
        </p>
      }
      error={
        <p className="text-sm px-2 py-4" style={{ color: 'var(--danger)' }}>
          无法渲染该 PDF
        </p>
      }
      className="flex flex-col items-center gap-2"
    >
      {Array.from({ length: numPages }, (_, i) => (
        <div
          key={i + 1}
          className="rounded border shadow-sm overflow-hidden"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <Page pageNumber={i + 1} width={368} className="block" />
        </div>
      ))}
    </Document>
  )
}
