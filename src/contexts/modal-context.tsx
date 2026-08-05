import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export type ModalOptions = {
  title: string
  description?: string
  content?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void | Promise<void>
  variant?: 'default' | 'destructive'
}

type ModalContextValue = {
  openModal: (opts: ModalOptions) => void
  closeModal: () => void
}

const ModalContext = React.createContext<ModalContextValue | null>(null)

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [opts, setOpts] = React.useState<ModalOptions | null>(null)
  const [busy, setBusy] = React.useState(false)

  const openModal = React.useCallback((o: ModalOptions) => {
    setOpts(o)
    setOpen(true)
  }, [])

  const closeModal = React.useCallback(() => {
    setOpen(false)
    setBusy(false)
    setTimeout(() => setOpts(null), 200)
  }, [])

  const onConfirm = React.useCallback(async () => {
    if (!opts?.onConfirm) {
      closeModal()
      return
    }
    setBusy(true)
    try {
      await opts.onConfirm()
      closeModal()
    } finally {
      setBusy(false)
    }
  }, [opts, closeModal])

  const value = React.useMemo(() => ({ openModal, closeModal }), [openModal, closeModal])

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="sm:max-w-md">
          {opts ? (
            <>
              <DialogHeader>
                <DialogTitle>{opts.title}</DialogTitle>
                {opts.description ? <DialogDescription>{opts.description}</DialogDescription> : null}
              </DialogHeader>
              {opts.content}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={closeModal} disabled={busy}>
                  {opts.cancelLabel ?? 'Cancel'}
                </Button>
                {opts.onConfirm ? (
                  <Button
                    type="button"
                    variant={opts.variant === 'destructive' ? 'destructive' : 'default'}
                    onClick={() => void onConfirm()}
                    disabled={busy}
                  >
                    {opts.confirmLabel ?? 'Confirm'}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = React.useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}
