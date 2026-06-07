import React, { useRef, useState } from 'react'
import { uploadFile, type UploadType } from '../lib/api/uploads'
import { storageUrl } from '../lib/api/public'

interface Props {
  uploadType: UploadType
  currentPath: string | null
  bucket?: string
  accept?: string
  label: string
  hint?: string
  onUploaded: (path: string, publicUrl: string) => void
  obligation_id?: string
}

export default function ImageUpload({
  uploadType,
  currentPath,
  bucket = 'public-assets',
  accept = 'image/jpeg,image/png,image/webp',
  label,
  hint,
  onUploaded,
  obligation_id,
}: Props) {
  const inputRef             = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr]            = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const existingUrl = previewUrl ?? storageUrl(currentPath, bucket)

  const handleFile = async (file: File) => {
    setErr(''); setUploading(true)
    try {
      const { path, publicUrl } = await uploadFile(uploadType, file, obligation_id)
      setPreviewUrl(publicUrl)
      onUploaded(path, publicUrl)
    } catch (e: any) {
      setErr(e.message ?? 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <label className="font-condensed text-[10px] font-bold tracking-[0.35em] uppercase text-gray-3 block mb-2">
        {label}
      </label>
      {hint && <p className="font-condensed text-[11px] text-gray-3 mb-2">{hint}</p>}

      {/* Preview */}
      {existingUrl && (
        <div className="mb-3 relative overflow-hidden border border-charcoal-3"
          style={{ height: 120, background: '#141416' }}>
          <img src={existingUrl} alt={label} className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-end p-2" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
            <span className="font-condensed text-[10px] text-off-white">Current {label.toLowerCase()}</span>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className="border border-dashed border-charcoal-3 p-6 text-center cursor-pointer transition-colors hover:border-blood"
        style={{ background: '#0d0d10' }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-charcoal-3 border-t-blood-glow rounded-full animate-spin" />
            <span className="font-condensed text-[12px] text-gray-3">Uploading…</span>
          </div>
        ) : (
          <>
            <p className="font-condensed text-[12px] text-gray-2 mb-1">
              {existingUrl ? 'Replace' : 'Upload'} {label.toLowerCase()}
            </p>
            <p className="font-condensed text-[10px] text-gray-3">
              Click or drag & drop · {accept.split(',').map(t => t.split('/')[1]).join(', ').toUpperCase()}
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onInputChange}
        disabled={uploading}
      />

      {err && <p className="font-condensed text-[11px] text-blood-glow mt-2">{err}</p>}
    </div>
  )
}
