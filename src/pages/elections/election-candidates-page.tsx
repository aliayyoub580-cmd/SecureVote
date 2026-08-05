import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Plus, ArrowLeft, Users, Zap, Database as DatabaseIcon, Trash2, Edit3, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router-dom'
import { toast } from '@/lib/toast'

import { CandidateCard } from '@/components/candidates/candidate-card'
import { CandidatePhotoDropzone } from '@/components/candidates/candidate-photo-dropzone'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ROUTES } from '@/constants/routes'
import { candidateFormSchema, type CandidateFormValues } from '@/lib/schemas/candidate'
import { electionsService } from '@/services/elections.service'
import { pollsService } from '@/services/polls.service'
import type { Database } from '@/types/database'

type Candidate = Database['public']['Tables']['election_candidates']['Row']
type Poll = Database['public']['Tables']['election_polls']['Row']

function swapOrder(ids: string[], i: number, j: number): string[] {
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function ElectionCandidatesPage() {
  const { id } = useParams()
  const [electionTitle, setElectionTitle] = useState('')
  const [electionStatus, setElectionStatus] = useState('')
  const [rows, setRows] = useState<Candidate[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null)

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      poll_id: '',
      name: '',
      designation: '',
      bio: '',
      manifesto: '',
    },
  })

  const load = useCallback(async () => {
    if (!id) return
    const e = await electionsService.getById(id)
    setElectionTitle(e?.title ?? '')
    setElectionStatus(e?.status ?? '')
    const [c, p] = await Promise.all([electionsService.listCandidates(id), pollsService.list(id)])
    setRows(c)
    setPolls(p)
  }, [id])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        await load()
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  const openAdd = () => {
    setEditing(null)
    setPendingPhoto(null)
    form.reset({
      poll_id: polls[0]?.id ?? '',
      name: '',
      designation: '',
      bio: '',
      manifesto: '',
    })
    setFormOpen(true)
  }

  const openEdit = (c: Candidate) => {
    setEditing(c)
    setPendingPhoto(null)
    form.reset({
      poll_id: c.poll_id,
      name: c.name,
      designation: c.designation ?? '',
      bio: c.bio ?? '',
      manifesto: c.manifesto ?? '',
    })
    setFormOpen(true)
  }

  const countInPoll = (pollId: string) => rows.filter((r) => r.poll_id === pollId).length

  const submitForm = form.handleSubmit(async (values) => {
    if (!id) return
    try {
      const designation = values.designation?.trim() || null
      const bio = values.bio?.trim() || null
      const manifesto = values.manifesto?.trim() || null
      const name = values.name.trim()

      if (editing) {
        await electionsService.updateCandidate(editing.id, {
          poll_id: values.poll_id,
          name,
          designation,
          bio,
          manifesto,
        })
        if (pendingPhoto) {
          const url = await electionsService.uploadCandidateImage(pendingPhoto, id, editing.id)
          await electionsService.updateCandidate(editing.id, { image_path: url })
        }
        toast.success('Candidate profile updated')
      } else {
        const order = countInPoll(values.poll_id)
        const row = await electionsService.addCandidate({
          election_id: id,
          poll_id: values.poll_id,
          name,
          designation,
          bio,
          manifesto,
          display_order: order,
        })
        if (pendingPhoto) {
          const url = await electionsService.uploadCandidateImage(pendingPhoto, id, row.id)
          await electionsService.updateCandidate(row.id, { image_path: url })
        }
        toast.success('Candidate added successfully')
      }
      setFormOpen(false)
      setPendingPhoto(null)
      setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    }
  })

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await electionsService.deleteCandidate(deleteTarget.id)
      setDeleteTarget(null)
      await load()
      toast.success('Candidate removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const reorder = async (pollId: string, fromIndex: number, dir: -1 | 1) => {
    if (!id) return
    const list = rows.filter((c) => c.poll_id === pollId)
    const toIndex = fromIndex + dir
    if (toIndex < 0 || toIndex >= list.length) return
    const ids = list.map((c) => c.id)
    const nextIds = swapOrder(ids, fromIndex, toIndex)
    try {
      await electionsService.reorderCandidatesInPoll(id, pollId, nextIds)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder')
    }
  }

  if (!id) return null
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Syncing Candidate Data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-12 pb-32 transition-colors duration-500">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 border-b border-border pb-12">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Candidate Management</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter mb-4 leading-none">Manage Candidates</h1>
          <p className="text-muted-foreground text-lg font-medium leading-relaxed max-w-2xl">
            {electionTitle || 'Add and manage candidates for each section of your election.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Button asChild variant="outline" className="rounded-xl h-12 px-6 font-bold uppercase tracking-widest text-[10px]">
            <Link 
              to={['draft', 'pending_approval', 'rejected'].includes(electionStatus) ? `${ROUTES.electionWizard(id)}?step=3` : ROUTES.electionEdit(id)} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="size-3.5" strokeWidth={3} />
              {['draft', 'pending_approval', 'rejected'].includes(electionStatus) ? 'Back to Wizard' : 'Back to Control Panel'}
            </Link>
          </Button>
          <Button
            type="button"
            className="rounded-xl premium-gradient h-12 px-6 font-bold uppercase tracking-widest text-[10px] shadow-lg hover:scale-105 transition-all gap-2"
            onClick={openAdd}
            disabled={!polls.length || ['approved', 'active', 'closed'].includes(electionStatus)}
          >
            <Plus className="size-4" strokeWidth={3} />
            Add Candidate
          </Button>
        </div>
      </div>

      <Card className="rounded-[2.5rem] border-border bg-card shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
          <Users className="size-64 text-primary" />
        </div>
        <CardHeader className="p-8 lg:p-12 pb-6 relative z-10 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <DatabaseIcon className="size-5 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground tracking-tight leading-none">Election Ballot</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground font-medium text-base max-w-2xl">
            Organize candidates and their profiles. The order below determines how they will appear to voters.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 lg:p-12 relative z-10">
          {polls.length === 0 ? (
            <div className="p-16 rounded-[2rem] border border-dashed border-border bg-muted/20 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Setup your election sections in the wizard first.</p>
            </div>
          ) : (
            <LayoutGroup>
              <div className="space-y-16">
                {polls.map((p) => {
                  const list = rows.filter((c) => c.poll_id === p.id)
                  const isLocked = ['approved', 'active', 'closed'].includes(electionStatus)
                  return (
                    <section key={p.id} className="space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-muted/50 px-4 py-1.5 rounded-full border border-border shadow-sm">
                          <Zap className="size-3.5 text-primary" />
                          <h2 className="text-[10px] font-bold uppercase tracking-widest text-foreground">{p.title}</h2>
                        </div>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      
                      <AnimatePresence mode="popLayout">
                        <motion.div className="grid gap-4">
                          {list.map((c, idx) => (
                            <CandidateCard
                              key={c.id}
                              candidate={c}
                              electionId={id}
                              pollTitle={p.title}
                              disableMoveUp={idx === 0 || isLocked}
                              disableMoveDown={idx === list.length - 1 || isLocked}
                              onMoveUp={() => void reorder(p.id, idx, -1)}
                              onMoveDown={() => void reorder(p.id, idx, 1)}
                              onEdit={() => openEdit(c)}
                              onDelete={() => setDeleteTarget(c)}
                              isLocked={isLocked}
                            />
                          ))}
                          {list.length === 0 && (
                            <div className="p-12 rounded-2xl border border-dashed border-border bg-muted/10 text-center">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">No candidates added to this section yet</p>
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </section>
                  )
                })}
              </div>
            </LayoutGroup>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[2.5rem] border-border bg-card p-0 shadow-2xl">
          <DialogHeader className="p-8 lg:p-10 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Edit3 className="size-5 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold text-foreground tracking-tight leading-none">{editing ? 'Edit Candidate' : 'Add New Candidate'}</DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground font-medium text-base">
              Fill in the candidate's professional details and manifesto.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submitForm()
            }}
            className="p-8 lg:p-10 space-y-8"
          >
            <div className="space-y-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ballot Section</Label>
              <Select value={form.watch('poll_id')} onValueChange={(v) => form.setValue('poll_id', v)}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-border font-bold">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  {polls.map((pol) => (
                    <SelectItem key={pol.id} value={pol.id} className="rounded-lg font-medium">
                      {pol.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.poll_id ? (
                <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.poll_id.message}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <Label htmlFor="cand-name" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Candidate Full Name</Label>
              <Input id="cand-name" className="h-14 rounded-xl bg-muted/50 border-border text-lg font-bold tracking-tight" placeholder="Enter name" {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <Label htmlFor="cand-des" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Designation / Title</Label>
              <Input
                id="cand-des"
                className="h-14 rounded-xl bg-muted/50 border-border font-bold"
                placeholder="e.g. Senior Representative"
                {...form.register('designation')}
              />
              {form.formState.errors.designation ? (
                <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.designation.message}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <Label htmlFor="cand-bio" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Brief Bio</Label>
              <Textarea id="cand-bio" rows={3} className="rounded-xl bg-muted/50 border-border font-medium resize-none p-4" placeholder="Short introduction..." {...form.register('bio')} />
              {form.formState.errors.bio ? (
                <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.bio.message}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <Label htmlFor="cand-man" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Candidate Manifesto</Label>
              <Textarea
                id="cand-man"
                rows={5}
                className="rounded-xl bg-muted/50 border-border font-medium resize-y min-h-[140px] p-4"
                placeholder="Full manifesto or goals..."
                {...form.register('manifesto')}
              />
              {form.formState.errors.manifesto ? (
                <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.manifesto.message}</p>
              ) : null}
            </div>
            <div className="space-y-3">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Profile Photo</Label>
              <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
                <CandidatePhotoDropzone
                  file={pendingPhoto}
                  onFileChange={setPendingPhoto}
                  existingUrl={editing?.image_path}
                  disabled={form.formState.isSubmitting}
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-4 pt-4 border-t border-border mt-4">
              <Button type="button" variant="outline" className="h-12 rounded-xl border-border bg-background hover:bg-muted px-8 font-bold uppercase tracking-widest text-[10px] flex-1" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="h-12 rounded-xl premium-gradient px-8 font-bold uppercase tracking-widest text-[10px] flex-1 shadow-sm" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : editing ? 'Update Profile' : 'Add Candidate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-[2rem] border-border bg-card p-10 shadow-2xl">
          <AlertDialogHeader className="space-y-4">
            <div className="size-14 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 mx-auto lg:mx-0">
              <Trash2 className="size-7 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-foreground tracking-tight leading-none">Remove Candidate?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground font-medium text-base">
              {deleteTarget ? `Are you sure you want to remove "${deleteTarget.name}" from this election?` : ''} This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-8 gap-4">
            <AlertDialogCancel className="h-12 rounded-xl border-border bg-background hover:bg-muted px-8 font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="h-12 rounded-xl bg-rose-500 hover:bg-rose-600 text-white px-8 font-bold uppercase tracking-widest text-[10px] shadow-lg border-0" onClick={() => void confirmDelete()}>
              Remove Candidate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
