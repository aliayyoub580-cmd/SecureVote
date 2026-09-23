import { useState } from 'react'
import { Check, Copy, Download, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { savedVoterCodesService } from '@/services/saved-voter-codes.service'

interface SaveVoterIdDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  electionTitle: string
  votingCode: string
}

export function SaveVoterIdDialog({
  open,
  onOpenChange,
  electionTitle,
  votingCode,
}: SaveVoterIdDialogProps) {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(votingCode)
      setCopied(true)
      toast.success('Voting ID copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy ID to clipboard')
    }
  }

  const handleDownload = () => {
    savedVoterCodesService.downloadCredentialsFile(electionTitle, votingCode)
    setDownloaded(true)
    toast.success('Credentials file downloaded!')
    setTimeout(() => setDownloaded(false), 2500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 sm:p-8 bg-zinc-950/95 border border-zinc-800 shadow-2xl backdrop-blur-2xl">
        <DialogHeader className="space-y-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
              <KeyRound className="size-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-500">
                Action Required
              </span>
              <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Save Your Voting ID
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm font-medium text-zinc-400 leading-relaxed pt-1">
            Email sending has been stopped. Please save or copy your secret ID now — you will need this
            code to cast your vote in <strong className="text-zinc-200">{electionTitle}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Voting Code Display Box */}
        <div className="space-y-4 my-2">
          <div className="relative rounded-2xl bg-gradient-to-b from-zinc-900/90 to-zinc-900/40 border border-zinc-700/60 p-5 text-center shadow-inner">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-2">
              Your Official Voting ID
            </span>
            <div className="flex items-center justify-center gap-3 my-1">
              <code className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-emerald-400 select-all">
                {votingCode}
              </code>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 font-medium">
              Election: <span className="text-zinc-300 font-semibold">{electionTitle}</span>
            </p>
          </div>

          {/* Action buttons to copy and download */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="h-12 rounded-xl border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all hover:border-zinc-600"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-emerald-400" />
                  <span className="text-emerald-400">Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="size-4 text-zinc-400" />
                  <span>Copy Voting ID</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              className="h-12 rounded-xl border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all hover:border-zinc-600"
            >
              {downloaded ? (
                <>
                  <Check className="size-4 text-emerald-400" />
                  <span className="text-emerald-400">Saved to File</span>
                </>
              ) : (
                <>
                  <Download className="size-4 text-zinc-400" />
                  <span>Download (.txt)</span>
                </>
              )}
            </Button>
          </div>

          {/* Security Notice */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 flex items-start gap-3">
            <ShieldAlert className="size-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 leading-relaxed font-medium space-y-1">
              <p>
                <strong>Keep this ID safe:</strong> This code is saved in your browser alongside this election name, but we strongly advise copying or saving it somewhere secure so you do not lose access.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <ShieldCheck className="size-4 shrink-0" />
            <span>Saved to this browser with election name: {electionTitle}</span>
          </div>
        </div>

        <DialogFooter className="pt-2 sm:pt-4">
          <Button
            type="button"
            className="w-full h-12 rounded-xl btn-primary font-bold text-sm"
            onClick={() => onOpenChange(false)}
          >
            I Have Saved My ID
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
