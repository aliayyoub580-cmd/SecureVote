import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw,
  FileText, Loader2, Printer
} from 'lucide-react'
import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Set worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface DocumentViewerModalProps {
  open: boolean
  url: string
  fileName: string
  fileSize?: number | null
  mediaType?: string
  onClose: () => void
}

export function DocumentViewerModal({
  open,
  url,
  fileName,
  fileSize,
  mediaType = 'pdf',
  onClose,
}: DocumentViewerModalProps) {
  const isPdf = mediaType === 'pdf' || fileName.toLowerCase().endsWith('.pdf')
  const isDocx = fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')

  const [numPages, setNumPages] = React.useState<number>(1)
  const [pageNumber, setPageNumber] = React.useState<number>(1)
  const [scale, setScale] = React.useState<number>(1.2)
  const [loading, setLoading] = React.useState<boolean>(true)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [docxHtml, setDocxHtml] = React.useState<string | null>(null)
  const [pdfDoc, setPdfDoc] = React.useState<pdfjsLib.PDFDocumentProxy | null>(null)

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  // Reset state and fetch document as ArrayBuffer when modal opens
  React.useEffect(() => {
    if (!open) return
    setPageNumber(1)
    setScale(1.2)
    setErrorMsg(null)
    setLoading(true)
    setPdfDoc(null)
    setDocxHtml(null)

    let isMounted = true

    async function loadDoc() {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: Failed to fetch file`)
        const arrayBuffer = await resp.arrayBuffer()
        if (!isMounted) return

        if (isPdf) {
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
          const doc = await loadingTask.promise
          if (!isMounted) return
          setPdfDoc(doc)
          setNumPages(doc.numPages)
          setLoading(false)
        } else if (isDocx) {
          const result = await mammoth.convertToHtml({ arrayBuffer })
          if (!isMounted) return
          setDocxHtml(result.value)
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (err: any) {
        console.error('[DocumentViewerModal]', err)
        if (isMounted) {
          setErrorMsg(err?.message || 'Failed to load document preview.')
          setLoading(false)
        }
      }
    }

    void loadDoc()

    return () => {
      isMounted = false
    }
  }, [open, url, isPdf, isDocx])

  // Render PDF page to canvas when pdfDoc, pageNumber, or scale changes
  React.useEffect(() => {
    if (!open || !isPdf || !pdfDoc || !canvasRef.current) return

    let renderTask: pdfjsLib.RenderTask | null = null

    async function renderPage() {
      try {
        const page = await pdfDoc!.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current!
        const context = canvas.getContext('2d')
        if (!context) return

        canvas.height = viewport.height
        canvas.width = viewport.width

        renderTask = page.render({ canvasContext: context, viewport })
        await renderTask.promise
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('[DocumentViewerModal RenderPage]', err)
        }
      }
    }

    void renderPage()

    return () => {
      if (renderTask) {
        renderTask.cancel()
      }
    }
  }, [open, isPdf, pdfDoc, pageNumber, scale])

  // Handle keyboard navigation
  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setPageNumber(p => Math.min(numPages, p + 1))
      else if (e.key === 'ArrowLeft') setPageNumber(p => Math.max(1, p - 1))
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, numPages, onClose])

  if (!open) return null

  const sizeKb = fileSize ? (fileSize / 1024).toFixed(0) : null
  const sizeMb = fileSize && fileSize > 1024 * 1024 ? (fileSize / (1024 * 1024)).toFixed(1) : null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 backdrop-blur-xl text-slate-100 animate-in fade-in duration-200">
        {/* Top Control Bar */}
        <header className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-900/90 border-b border-slate-800 shrink-0">
          {/* File Metadata */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`size-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
              isPdf ? 'bg-[var(--accent-danger)]/20 text-[var(--accent-danger)] border border-[var(--accent-danger)]/30' : 'bg-[var(--accent-info)]/20 text-[var(--accent-info)] border border-[var(--accent-info)]/30'
            }`}>
              {isPdf ? 'PDF' : 'DOC'}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-100 truncate max-w-md" title={fileName}>
                {fileName}
              </h3>
              <p className="text-xs text-slate-400">
                {sizeMb ? `${sizeMb} MB` : sizeKb ? `${sizeKb} KB` : 'Document'} {isPdf && numPages > 1 ? `· ${numPages} Pages` : ''}
              </p>
            </div>
          </div>

          {/* Page Controls (PDF) */}
          {isPdf && !loading && !errorMsg && (
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-medium">
              <button
                type="button"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-slate-300 font-bold px-1">
                Page {pageNumber} <span className="text-slate-500 font-normal">of {numPages}</span>
              </span>
              <button
                type="button"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          {/* Zoom & Action Controls */}
          <div className="flex items-center gap-2">
            {isPdf && !loading && !errorMsg && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-300"
                  title="Zoom Out"
                >
                  <ZoomOut className="size-3.5" />
                </button>
                <span className="w-12 text-center text-[11px] font-mono text-slate-400">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-300"
                  title="Zoom In"
                >
                  <ZoomIn className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setScale(1.2)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors text-slate-400 ml-1"
                  title="Reset Zoom"
                >
                  <RotateCcw className="size-3" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-1"
              aria-label="Close document viewer"
            >
              <X className="size-5" />
            </button>
          </div>
        </header>

        {/* Main Document Content Area */}
        <main className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center select-none bg-slate-950/80">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-20">
              <Loader2 className="size-8 animate-spin text-[var(--accent-primary)]" />
              <p className="text-sm font-medium">Loading PDF document viewer...</p>
            </div>
          ) : errorMsg ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center max-w-md p-8 bg-slate-900 border border-slate-800 rounded-3xl">
              <div className="size-14 rounded-2xl bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 flex items-center justify-center text-[var(--accent-danger)]">
                <FileText className="size-7" />
              </div>
              <div>
                <h4 className="font-bold text-slate-200 mb-1">Preview Unavailable</h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">{errorMsg}</p>
              </div>
            </div>
          ) : isPdf ? (
            <div className="relative shadow-2xl rounded-lg overflow-hidden bg-white my-auto">
              <canvas ref={canvasRef} className="block max-w-full h-auto" />
            </div>
          ) : docxHtml ? (
            <div className="w-full max-w-3xl bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl overflow-y-auto max-h-[80vh] prose prose-slate">
              <div dangerouslySetInnerHTML={{ __html: docxHtml }} />
            </div>
          ) : (
            <iframe
              src={url}
              title={fileName}
              className="w-full h-full max-w-5xl rounded-2xl border border-slate-800 shadow-2xl bg-white"
            />
          )}
        </main>
      </div>
    </AnimatePresence>
  )
}
