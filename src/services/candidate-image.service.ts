import { supabase } from '@/lib/supabase/client'

const BUCKET = 'candidate-images'
const MAX_BYTES = 4 * 1024 * 1024 // 4 MiB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export const candidateImageService = {
  maxBytes: MAX_BYTES,

  validate(file: File): string | null {
    if (!ALLOWED.has(file.type)) return 'Use JPEG, PNG, WebP, or GIF.'
    if (file.size > MAX_BYTES) return 'Image must be 4 MB or smaller.'
    return null
  },

  /** Uploads to `candidate-images/{electionId}/{candidateId}.{ext}` and returns public URL. */
  async upload(electionId: string, candidateId: string, file: File): Promise<string> {
    const err = this.validate(file)
    if (err) throw new Error(err)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg'
    const path = `${electionId}/${candidateId}.${safeExt}`
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  },
}
