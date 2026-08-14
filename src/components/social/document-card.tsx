import * as React from 'react'
import { FileText, ZoomIn, Loader2 } from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'
import { supabase } from '@/lib/supabase/client'
import { socialMediaService } from '@/services/social.service'
import { DocumentViewerModal } from './document-viewer-modal'
import type { PostMedia } from '@/types/social'

// Configure worker URL for pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface DocumentCardProps {
  media: PostMedia
}

export function DocumentCard({ media }: DocumentCardProps) {
  const fileName = media.file_name ?? 'Document.pdf'
  const isPdf = media.media_type === 'pdf' || fileName.toLowerCase().endsWith('.pdf')
  const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')

  const [modalOpen, setModalOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activeUrl, setActiveUrl] = React.useState<string>('')

  // PDF State
  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [renderingPage, setRenderingPage] = React.useState<boolean>(false)

  // DOCX State
  const [docxHtml, setDocxHtml] = React.useState<string | null>(null)

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  // Fetch document arrayBuffer across candidate URLs & SDK download fallback
  React.useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    async function loadDocument() {
      const candidateUrls = socialMediaService.getMediaUrls
        ? socialMediaService.getMediaUrls(media)
        : [socialMediaService.getImageUrl(media.storage_path)]

      let fetchedBuffer: ArrayBuffer | null = null
      let successfulUrl = candidateUrls[0] || ''

      for (const urlCandidate of candidateUrls) {
        if (!urlCandidate) continue
        try {
          const res = await fetch(urlCandidate)
          if (res.ok) {
            fetchedBuffer = await res.arrayBuffer()
            successfulUrl = urlCandidate
            break
          }
        } catch {
          // try next candidate
        }
      }

      // SDK download fallback if fetch was blocked or failed
      if (!fetchedBuffer && media.storage_path) {
        try {
          const bucket = isPdf || isDocx ? 'post-pdfs' : 'post-images'
          const { data: blob } = await supabase.storage.from(bucket).download(media.storage_path)
          if (blob) {
            fetchedBuffer = await blob.arrayBuffer()
            successfulUrl = socialMediaService.getMediaUrl(media)
          }
        } catch (sdkErr) {
          console.error('[DocumentCard SDK Fallback Error]', sdkErr)
        }
      }

      if (!isMounted) return

      if (!fetchedBuffer) {
        setError('Document preview unavailable')
        setLoading(false)
        return
      }

      setActiveUrl(successfulUrl)

      try {
        if (isPdf) {
          const loadingTask = pdfjsLib.getDocument({ data: fetchedBuffer })
          const doc = await loadingTask.promise
          if (!isMounted) return
          setPdfDoc(doc)
          setLoading(false)
        } else if (isDocx) {
          const result = await mammoth.convertToHtml({ arrayBuffer: fetchedBuffer })
          if (!isMounted) return
          setDocxHtml(result.value)
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (err: any) {
        console.error('[DocumentCard Parse]', err)
        if (isMounted) {
          setError(err?.message || 'Unable to render document preview')
          setLoading(false)
        }
      }
    }

    void loadDocument()

    return () => {
      isMounted = false
    }
  }, [media, isPdf, isDocx])

  // Render Page 1 of PDF to canvas
  React.useEffect(() => {
    if (!isPdf || !pdfDoc || !canvasRef.current) return

    let renderTask: pdfjsLib.RenderTask | null = null
    setRenderingPage(true)

    async function renderPage1() {
      try {
        const page = await pdfDoc!.getPage(1)
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const targetWidth = containerRef.current?.clientWidth || 600
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        const scale = (targetWidth / unscaledViewport.width) * 1.5
        const viewport = page.getViewport({ scale })

        canvas.width = viewport.width
        canvas.height = viewport.height

        renderTask = page.render({ canvasContext: ctx, viewport })
        await renderTask.promise
        setRenderingPage(false)
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[DocumentCard RenderPage]', err)
        }
        setRenderingPage(false)
      }
    }

    void renderPage1()

    return () => {
      if (renderTask) {
        renderTask.cancel()
      }
    }
  }, [isPdf, pdfDoc])

  return (
    <>
      {/* PDF Container taking the EXACT same place and styling as a Post Image */}
      <div
        ref={containerRef}
        onClick={() => setModalOpen(true)}
        className="relative w-full rounded-2xl overflow-hidden bg-[#031F28] border border-[var(--border)] group cursor-pointer my-3 shadow-sm transition-all hover:border-[var(--accent-primary)]/50"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#7FA3AB] bg-[#021820]">
            <Loader2 className="size-8 animate-spin text-[var(--accent-primary)]" />
            <p className="text-xs font-semibold">Loading PDF preview...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center max-w-sm mx-auto p-6 bg-[#031F28]">
            <FileText className="size-8 text-[var(--accent-danger)]" />
            <p className="text-xs text-[#7FA3AB]">{error}</p>
          </div>
        ) : isPdf ? (
          /* Rendered PDF Page Canvas directly as post media */
          <div className="relative w-full overflow-hidden bg-white">
            <canvas ref={canvasRef} className="w-full h-auto block" />
            {renderingPage && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-[var(--accent-primary)]" />
              </div>
            )}
          </div>
        ) : docxHtml ? (
          /* DOCX Formatted Paper Sheet */
          <div className="w-full bg-white text-slate-900 p-6 sm:p-8 overflow-hidden prose prose-slate text-xs leading-relaxed font-serif max-h-[400px]">
            <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </div>
        ) : (
          /* Fallback */
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center bg-[#021820]">
            <FileText className="size-12 text-[var(--accent-primary)]" />
            <p className="text-sm font-bold text-[#EDF7F6]">{fileName}</p>
          </div>
        )}

        {/* Zoom / Fullscreen Hover Icon (Exact same as Image attachments) */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="p-3 rounded-2xl bg-black/70 backdrop-blur-md text-white shadow-2xl flex items-center gap-2 text-xs font-bold">
            <ZoomIn className="size-5 text-[var(--accent-primary)]" />
            <span>Click to view full screen</span>
          </div>
        </div>
      </div>

      {/* Fullscreen Interactive Viewer Modal */}
      <DocumentViewerModal
        open={modalOpen}
        url={activeUrl || socialMediaService.getImageUrl(media.storage_path)}
        fileName={fileName}
        fileSize={media.file_size}
        mediaType={isPdf ? 'pdf' : 'docx'}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
