'use client'

import { useState, useEffect, useCallback } from 'react'
import { isImageFile, formatBytes, fileHref } from './FileUpload'

interface Attachment {
  id: string
  fileUrl: string
  fileName: string
  fileSize?: number
  mimeType?: string | null
}

export default function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter(a => isImageFile(a.mimeType, a.fileName))
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const close = useCallback(() => setLightboxIndex(null), [])
  const showPrev = useCallback(() => setLightboxIndex(i => (i === null ? i : (i - 1 + images.length) % images.length)), [images.length])
  const showNext = useCallback(() => setLightboxIndex(i => (i === null ? i : (i + 1) % images.length)), [images.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') showPrev()
      else if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, close, showPrev, showNext])

  if (!attachments.length) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {attachments.map(a => {
        const img = isImageFile(a.mimeType, a.fileName)
        if (img) {
          const imgIndex = images.findIndex(i => i.id === a.id)
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setLightboxIndex(imgIndex)}
              className="group flex items-center gap-2 border border-gray-100 rounded-lg pl-2 pr-3 py-1.5 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors bg-gray-50"
              title="Kép megtekintése"
            >
              <svg className="w-5 h-5 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-600 group-hover:text-indigo-600 max-w-40 truncate">{a.fileName}</span>
              {a.fileSize ? <span className="text-[10px] text-gray-400">{formatBytes(a.fileSize)}</span> : null}
            </button>
          )
        }
        return (
          <a
            key={a.id}
            href={fileHref(a.fileUrl)}
            target="_blank"
            rel="noreferrer"
            download
            className="group flex items-center gap-2 border border-gray-100 rounded-lg pl-2 pr-3 py-1.5 hover:border-indigo-200 transition-colors bg-gray-50"
            title="Letöltés"
          >
            <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs text-gray-600 group-hover:text-indigo-600 max-w-40 truncate">{a.fileName}</span>
            {a.fileSize ? <span className="text-[10px] text-gray-400">{formatBytes(a.fileSize)}</span> : null}
          </a>
        )
      })}

      {/* Lightbox — image is only fetched once opened */}
      {lightboxIndex !== null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={close}
        >
          <button
            onClick={close}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
            title="Bezárás (Esc)"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); showPrev() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
                title="Előző (←)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); showNext() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2"
                title="Következő (→)"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}

          <figure className="max-w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileHref(images[lightboxIndex].fileUrl)}
              alt={images[lightboxIndex].fileName}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
            <figcaption className="mt-3 text-white/70 text-sm flex items-center gap-3">
              <span className="truncate max-w-md">{images[lightboxIndex].fileName}</span>
              {images.length > 1 && <span className="text-white/40">{lightboxIndex + 1} / {images.length}</span>}
              <a href={fileHref(images[lightboxIndex].fileUrl)} download target="_blank" rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="text-indigo-300 hover:text-indigo-200 underline">Letöltés</a>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  )
}
