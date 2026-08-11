import * as React from 'react'
import { ZoomIn } from 'lucide-react'
import { socialMediaService } from '@/services/social.service'
import { DocumentCard } from './document-card'
import type { PostMedia } from '@/types/social'

interface MediaGalleryProps { media: PostMedia[] }

export function MediaGallery({ media }: MediaGalleryProps) {
  const images = media.filter(m => m.media_type === 'image')
  const documents = media.filter(m =>
    m.media_type === 'pdf' ||
    m.media_type === ('doc' as any) ||
    m.media_type === ('docx' as any) ||
    !!m.file_name?.match(/\.(pdf|doc|docx)$/i)
  )
  const [lightbox, setLightbox] = React.useState<string | null>(null)

  const gridClass = images.length === 1 ? 'grid-cols-1' :
                    images.length === 2 ? 'grid-cols-2' :
                    images.length === 3 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className={`grid gap-1.5 rounded-2xl overflow-hidden ${gridClass}`}>
          {images.slice(0, 4).map((m, i) => {
            const url = socialMediaService.getImageUrl(m.storage_path)
            const isExtra = i === 3 && images.length > 4
            return (
              <button key={m.id || m.storage_path} onClick={() => setLightbox(url)} className="relative aspect-video bg-[#031F28] overflow-hidden group">
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

      {documents.map(m => (
        <DocumentCard key={m.id || m.storage_path} media={m} />
      ))}

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  )
}
