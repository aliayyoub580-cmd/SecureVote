import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { candidateImageService } from '@/services/candidate-image.service'

type CandidatePhotoDropzoneProps = {
  className?: string
  disabled?: boolean
  /** Current file chosen for upload (preview is derived). */
  file: File | null
  onFileChange: (file: File | null) => void
  /** Existing stored image URL (shown when no new file). */
  existingUrl?: string | null
}

export function CandidatePhotoDropzone({
  className,
  disabled,
  file,
  onFileChange,
  existingUrl,
}: CandidatePhotoDropzoneProps) {
  const inputId = useId()
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const previewSrc = file ? objectUrl : existingUrl || null

  const applyFile = useCallback(
    (f: File | null) => {
      setLocalError(null)
      if (!f) {
        onFileChange(null)
        return
      }
      const err = candidateImageService.validate(f)
      if (err) {
        setLocalError(err)
        return
      }
      onFileChange(f)
    },
    [onFileChange],
  )

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    e.target.value = ''
    applyFile(f)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0] ?? null
    if (f) applyFile(f)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        id={inputId}
        disabled={disabled}
        onChange={onInput}
      />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            document.getElementById(inputId)?.click()
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && document.getElementById(inputId)?.click()}
        className={cn(
          'group relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all duration-200',
          dragOver ? 'border-primary/60 bg-primary/5 scale-[1.01]' : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {previewSrc ? (
          <>
            <img
              src={previewSrc}
              alt=""
              className="max-h-44 w-full rounded-xl object-contain object-center p-2"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-2 p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="shadow-md"
                disabled={disabled}
                onClick={(ev) => {
                  ev.stopPropagation()
                  document.getElementById(inputId)?.click()
                }}
              >
                <Upload className="mr-1 size-3.5" />
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="shadow-md"
                disabled={disabled}
                onClick={(ev) => {
                  ev.stopPropagation()
                  applyFile(null)
                }}
              >
                <Trash2 className="mr-1 size-3.5" />
                Clear
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImagePlus className="size-6" />
            </div>
            <div className="text-center text-sm">
              <p className="font-medium text-foreground">Drop a photo here</p>
              <p className="text-muted-foreground">or click to browse — JPEG, PNG, WebP, GIF · max 4 MB</p>
            </div>
          </>
        )}
      </div>
      {localError ? <p className="text-xs text-destructive">{localError}</p> : null}
    </div>
  )
}
