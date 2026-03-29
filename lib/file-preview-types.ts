export type FilePreviewPayload = {
  title: string
  mode: 'markdown' | 'text' | 'pdf' | 'docx' | 'spreadsheet'
  textBody?: string
  signedUrl?: string
  base64Body?: string
  source: 'agent' | 'files'
  fileId?: string
  saveUtf8?: string
  saveBase64?: string
}
