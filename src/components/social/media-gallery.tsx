import * as React from 'react'
import { FileText, ZoomIn } from 'lucide-react'
import { socialMediaService } from '@/services/social.service'
import type { PostMedia } from '@/types/social'

interface MediaGalleryProps { media: PostMedia[] }

export function MediaGallery({ media }: MediaGalleryProps) {
  const images = media.filter(m => m.media_type === 'image')
  const pdfs   = media.filter(m => m.media_type === 'pdf')
  const [lightbox, setLightbox] = React.useState<string | null>(null)

  const gridClass = images.length === 1 ? 'grid-cols-1' :
                    images.length === 2 ? 'grid-cols-2' :
                    images.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <>
      {images.length > 0 && (
        <div className={`grid gap-1.5 rounded-xl overflow-hidden ${gridClass}`}>
          {images.slice(0, 4).map((m, i) => {
            const url = socialMediaService.getImageUrl(m.storage_path)
            const isExtra = i === 3 && images.length > 4
            return (
              <button key={m.id} onClick={() => setLightbox(url)} className="relative aspect-video bg-[#031F28] overflow-hidden group">
                <img src={url} alt={m.file_name ?? ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                {isExtra && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl">
                    +{images.length - 4}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <ZoomIn className="size-6 text-white drop-shadow-lg" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {pdfs.map(m => (
        <div key={m.id} className="flex items-center gap-3 p-3 bg-[#031F28] border border-[#0F4A5E] rounded-xl mt-2">
          <div className="size-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="size-5 text-rose-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#EDF7F6] truncate">{m.file_name ?? 'Document'}</p>
            {m.file_size && <p className="text-xs text-[#7FA3AB]">{(m.file_size / 1024).toFixed(0)} KB · PDF</p>}
          </div>
        </div>
      ))}

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </>
  )
}
