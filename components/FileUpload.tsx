'use client'

import { useRef, useState } from 'react'

export interface UploadedFile {
  fileUrl: string
  fileName: string
  fileSize: number
  mimeType: string
}

export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
export const MAX_FILES = 5

export function isImageFile(mimeType?: string | null, fileName?: string) {
  if (mimeType?.startsWith('image/')) return true
  if (!fileName) return false
  return /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i.test(fileName)
}

// Local dev files are public under /uploads; production blobs are private and
// must be fetched through the authenticated /api/files proxy.
export function fileHref(fileUrl: string) {
  if (!fileUrl) return fileUrl
  if (fileUrl.startsWith('/uploads/') || fileUrl.startsWith('/api/files')) return fileUrl
  return `/api/files?url=${encodeURIComponent(fileUrl)}`
}

export function formatBytes(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface FileUploadProps {
  value: UploadedFile[]
  onChange: (files: UploadedFile[]) => void
}

export default function FileUpload({ value, onChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFiles(fileList: FileList) {
    setError('')
    const incoming = Array.from(fileList)

    const remaining = MAX_FILES - value.length
    if (remaining <= 0) {
      setError(`Legfeljebb ${MAX_FILES} fájl csatolható`)
      return
    }

    const toUpload = incoming.slice(0, remaining)
    if (incoming.length > remaining) {
      setError(`Legfeljebb ${MAX_FILES} fájl csatolható, a további fájlok kimaradtak`)
    }

    const results: UploadedFile[] = []
    setUploading(true)
    for (const file of toUpload) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" túl nagy (max 5 MB)`)
        continue
      }
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const d = await res.json().catch(() => ({}))
        if (res.ok && d.url) {
          results.push({ fileUrl: d.url, fileName: d.fileName, fileSize: d.size, mimeType: file.type })
        } else {
          setError(d.error || `"${file.name}" feltöltése nem sikerült`)
        }
      } catch {
        setError(`"${file.name}" feltöltése nem sikerült`)
      }
    }
    setUploading(false)
    if (results.length) onChange([...value, ...results])
    if (inputRef.current) inputRef.current.value = ''
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
    setError('')
  }

  const atMax = value.length >= MAX_FILES

  return (
    <div>
      {error && <p className="text-xs text-red-500 mb-1.5">{error}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {value.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-100 rounded-lg pl-2 pr-1.5 py-1">
              {isImageFile(f.mimeType, f.fileName) ? (
                <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              <span className="text-xs text-gray-600 max-w-32 truncate">{f.fileName}</span>
              {f.fileSize ? <span className="text-[10px] text-gray-400">{formatBytes(f.fileSize)}</span> : null}
              <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 p-0.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || atMax}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )}
        {uploading ? 'Feltöltés...' : atMax ? `Elérted a maximumot (${MAX_FILES})` : 'Fájl csatolása (max 5 MB, 5 db)'}
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
    </div>
  )
}
