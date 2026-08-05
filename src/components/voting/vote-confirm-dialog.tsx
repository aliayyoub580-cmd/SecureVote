import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export type VoteConfirmLine = { label: string; value: string }

type VoteConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  electionTitle: string
  lines: VoteConfirmLine[]
  tokenMasked: string
  confirming: boolean
  onConfirm: () => void
}

export function VoteConfirmDialog({
  open,
  onOpenChange,
  electionTitle,
  lines,
  tokenMasked,
  confirming,
  onConfirm,
}: VoteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border/60 bg-card/95 backdrop-blur-md sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm your ballot</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <p>
                You are about to submit an <span className="font-medium text-foreground">anonymous</span> ballot for{' '}
                <span className="font-medium text-foreground">{electionTitle}</span>. This cannot be undone.
              </p>
              <ul className="space-y-2 rounded-xl border border-border/50 bg-muted/30 p-3">
                {lines.map((row) => (
                  <li key={row.label} className="flex flex-col gap-0.5 text-xs sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <span className="shrink-0 font-medium text-foreground/90">{row.label}</span>
                    <span className="text-foreground">{row.value}</span>
                  </li>
                ))}
              </ul>
              <p className="rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 font-mono text-xs text-foreground">
                Token: <span className="font-semibold">{tokenMasked}</span>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Back</AlertDialogCancel>
          <AlertDialogAction
            disabled={confirming}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {confirming ? 'Submitting…' : 'Submit anonymously'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
