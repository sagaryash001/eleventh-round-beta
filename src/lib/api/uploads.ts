import { apiPost } from './client'

export type UploadType =
  | 'fighter-headshot'
  | 'fighter-banner'
  | 'fighter-media-kit'
  | 'sponsor-logo'
  | 'obligation-proof'
  | 'module-pdf'

export interface SignedUploadResponse {
  ok: boolean
  signedUrl: string
  path: string
  bucket: string
  maxBytes: number
}

/** Request a signed upload URL from the backend. */
export const getSignedUploadUrl = (
  type: UploadType,
  contentType: string,
  obligation_id?: string,
) =>
  apiPost<SignedUploadResponse>('/api/uploads/sign', { type, contentType, obligation_id })

/**
 * Upload a file directly to Supabase Storage using a signed URL.
 * Returns the storage path (not the full URL) that should be saved to the profile.
 */
export async function uploadFile(
  type: UploadType,
  file: File,
  obligation_id?: string,
): Promise<{ path: string; bucket: string; publicUrl: string }> {
  const { signedUrl, path, bucket, maxBytes } = await getSignedUploadUrl(
    type, file.type, obligation_id,
  )

  if (file.size > maxBytes) {
    throw new Error(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  }

  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => 'Upload failed')
    throw new Error(text || `Upload failed with status ${uploadRes.status}`)
  }

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string ?? ''
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`

  return { path, bucket, publicUrl }
}
