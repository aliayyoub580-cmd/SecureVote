import { zodResolver } from '@hookform/resolvers/zod'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Trash2, ShieldCheck, Activity, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from '@/lib/toast'

import { RichTextField } from '@/components/elections/rich-text-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/contexts/auth-context'
import { stripHtml } from '@/lib/html-utils'
import { electionWizardSchema, type ElectionWizardForm } from '@/lib/schemas/election-wizard'
import { auditService } from '@/services/audit.service'
import { electionsService } from '@/services/elections.service'
import { pollsService } from '@/services/polls.service'
import { notificationsService } from '@/services/notifications.service'
import type { Database } from '@/types/database'
import { cn } from '@/lib/utils'

type Poll = Database['public']['Tables']['election_polls']['Row']
type Election = Database['public']['Tables']['elections']['Row']

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STEPS = ['Information', 'Schedule', 'Voters', 'Candidates', 'Review'] as const

function defaultWindow() {
  const s = new Date()
  s.setMinutes(0, 0, 0)
  s.setHours(s.getHours() + 1)
  const e = new Date(s)
  e.setDate(e.getDate() + 7)
  return { startsAt: toLocalInput(s.toISOString()), endsAt: toLocalInput(e.toISOString()) }
}

function safeIso(val: string | null | undefined): string | null {
  if (!val || !val.trim()) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function ElectionWizardPage() {
  const { id: routeId } = useParams()
  const isCreate = !routeId
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const step = Math.min(STEPS.length - 1, Math.max(0, parseInt(searchParams.get('step') || '0', 10) || 0))
  const setStep = (s: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('step', String(s))
    setSearchParams(next, { replace: true })
  }
  const { profile } = useAuth()
  const [election, setElection] = useState<Election | null>(null)
  const [polls, setPolls] = useState<Poll[]>([])
  const [pollTitle, setPollTitle] = useState('')
  const [candidatesByPoll, setCandidatesByPoll] = useState<Record<string, number>>({})
  const [loadingElection, setLoadingElection] = useState(!isCreate)
  const saveTimer = useRef<any>(null)

  const form = useForm<ElectionWizardForm>({
    resolver: zodResolver(electionWizardSchema) as Resolver<ElectionWizardForm>,
    defaultValues: {
      title: '',
      descriptionHtml: '',
      category: '',
      organization: '',
      ...defaultWindow(),
      registrationOpensAt: '',
      registrationClosesAt: '',
      maxVoters: '',
      visibility: 'public',
    },
  })

  const electionId = routeId ?? election?.id

  const loadPollsAndCounts = useCallback(async (eid: string) => {
    const [plist, clist] = await Promise.all([pollsService.list(eid), electionsService.listCandidates(eid)])
    setPolls(plist)
    const map: Record<string, number> = {}
    for (const c of clist) {
      map[c.poll_id] = (map[c.poll_id] ?? 0) + 1
    }
    setCandidatesByPoll(map)
  }, [])

  const loadElection = useCallback(async () => {
    if (!routeId) return
    setLoadingElection(true)
    try {
      const row = await electionsService.getById(routeId)
      if (!row) {
        toast.error('Election not found')
        void navigate(ROUTES.creatorDashboard)
        return
      }
      if (row.created_by !== profile?.id) {
        toast.error('Identity mismatch')
        void navigate(ROUTES.creatorDashboard)
        return
      }
      if (!['draft', 'pending_approval', 'rejected', 'approved'].includes(row.status)) {
        void navigate(ROUTES.electionEdit(routeId), { replace: true })
        return
      }
      setElection(row)
      form.reset({
        title: row.title,
        descriptionHtml: row.description_html ?? '',
        category: row.category ?? '',
        organization: row.organization ?? '',
        startsAt: toLocalInput(row.starts_at),
        endsAt: toLocalInput(row.ends_at),
        registrationOpensAt: row.registration_opens_at ? toLocalInput(row.registration_opens_at) : '',
        registrationClosesAt: row.registration_closes_at ? toLocalInput(row.registration_closes_at) : '',
        maxVoters: row.max_voters != null ? String(row.max_voters) : '',
      })
      await loadPollsAndCounts(routeId)
    } finally {
      setLoadingElection(false)
    }
  }, [routeId, profile?.id, navigate, loadPollsAndCounts, form])

  useEffect(() => {
    if (routeId) void loadElection()
  }, [routeId, loadElection])

  const scheduleAutosave = useCallback(
    (eid: string, values: ElectionWizardForm) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void (async () => {
          try {
            const isApproved = election?.status === 'approved'
            const plain = stripHtml(values.descriptionHtml || '')

            // Limit increase validation for autosave
            if (isApproved && election) {
              const prevMax = election.max_voters
              const newMaxVal = values.maxVoters?.trim() ? parseInt(values.maxVoters, 10) : null
              if (prevMax !== null) {
                if (newMaxVal === null || newMaxVal < prevMax) {
                  return // skip autosave if invalid decrease
                }
              }
            }

            const updatePayload: any = {
              starts_at: new Date(values.startsAt).toISOString(),
              ends_at: new Date(values.endsAt).toISOString(),
              registration_opens_at: values.registrationOpensAt?.trim()
                ? new Date(values.registrationOpensAt).toISOString()
                : null,
              registration_closes_at: values.registrationClosesAt?.trim()
                ? new Date(values.registrationClosesAt).toISOString()
                : null,
              max_voters: (values.maxVoters !== undefined && values.maxVoters !== null && String(values.maxVoters).trim() !== '') ? parseInt(String(values.maxVoters), 10) : null,
              visibility: values.visibility,
            }

            if (!isApproved) {
              updatePayload.title = values.title
              updatePayload.description = plain ? plain.slice(0, 4000) : null
              updatePayload.description_html = values.descriptionHtml || null
              updatePayload.category = values.category?.trim() || null
              updatePayload.organization = values.organization?.trim() || null
            }

            await electionsService.update(eid, updatePayload)
          } catch {
            /* silent autosave */
          }
        })()
      }, 1200)
    },
    [election],
  )

  const watched = form.watch()
  useEffect(() => {
    if (!electionId) return
    scheduleAutosave(electionId, watched as ElectionWizardForm)
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [watched, electionId, scheduleAutosave])

  const persistNow = async (values: ElectionWizardForm, eid: string) => {
    const isApproved = election?.status === 'approved'
    const plain = stripHtml(values.descriptionHtml || '')

    if (isApproved && election) {
      const prevMax = election.max_voters
      const newMaxVal = values.maxVoters?.trim() ? parseInt(values.maxVoters, 10) : null
      if (prevMax !== null) {
        if (newMaxVal === null || newMaxVal < prevMax) {
          throw new Error(`Participant limit can only be increased (Current limit: ${prevMax})`)
        }
      }
    }

    const updatePayload: any = {
      starts_at: safeIso(values.startsAt) || new Date().toISOString(),
      ends_at: safeIso(values.endsAt) || new Date().toISOString(),
      registration_opens_at: safeIso(values.registrationOpensAt),
      registration_closes_at: safeIso(values.registrationClosesAt),
      max_voters: (values.maxVoters !== undefined && values.maxVoters !== null && String(values.maxVoters).trim() !== '') ? parseInt(String(values.maxVoters), 10) : null,
    }

    if (!isApproved) {
      updatePayload.title = values.title
      updatePayload.description = plain ? plain.slice(0, 4000) : null
      updatePayload.description_html = values.descriptionHtml || null
      updatePayload.category = values.category?.trim() || null
      updatePayload.organization = values.organization?.trim() || null
    }

    await electionsService.update(eid, updatePayload)
    await auditService.log('election.updated', 'election', eid, { source: 'wizard' }, { enrichClient: true })
  }

  const createDraft = async (values: ElectionWizardForm) => {
    if (!profile?.id) throw new Error('Not signed in')
    const plain = stripHtml(values.descriptionHtml || '')
    const row = await electionsService.create({
      title: values.title.trim() || 'Untitled election',
      description: plain ? plain.slice(0, 4000) : null,
      description_html: values.descriptionHtml || null,
      category: values.category?.trim() || null,
      organization: values.organization?.trim() || null,
      max_voters: (values.maxVoters !== undefined && values.maxVoters !== null && String(values.maxVoters).trim() !== '') ? parseInt(String(values.maxVoters), 10) : null,
      status: 'approved',
      approved_at: new Date().toISOString(),
      starts_at: safeIso(values.startsAt) || new Date().toISOString(),
      ends_at: safeIso(values.endsAt) || new Date().toISOString(),
      registration_opens_at: safeIso(values.registrationOpensAt),
      registration_closes_at: safeIso(values.registrationClosesAt),
      created_by: profile.id,
      // visibility: values.visibility, // Temp disabled due to schema cache error
    })
    await auditService.log('election.created', 'election', row.id, { title: row.title, wizard: true })
    setElection(row)
    await loadPollsAndCounts(row.id)
    void navigate(`${ROUTES.electionWizard(row.id)}?step=1`, { replace: true })
    return row.id
  }

  const goNext = async () => {
    if (step === 0) {
      const ok = await form.trigger(['title', 'startsAt', 'endsAt', 'registrationClosesAt', 'maxVoters'])
      if (!ok) {
        console.warn('Form validation failed:', form.formState.errors)
        return
      }
      const v = form.getValues()
      try {
        if (isCreate || !electionId) {
          await createDraft(v)
        } else {
          await persistNow(v, electionId)
        }
        setStep(1)
      } catch (e: any) {
        console.error('Wizard save error:', e)
        const msg = e.message || 'Failed to save'
        const code = e.code ? ` (Code: ${e.code})` : ''
        toast.error(`${msg}${code}`)
      }
      return
    }
    if (step === 1) {
      const ok = await form.trigger(['startsAt', 'endsAt', 'registrationClosesAt'])
      if (!ok) return
      const v = form.getValues()
      if (electionId) {
        try {
          await persistNow(v, electionId)
        } catch (e: any) {
          toast.error(e.message || 'Failed to save schedule details')
          return
        }
      }
      setStep(2)
    } else if (step === 2) {
      const ok = await form.trigger(['maxVoters'])
      if (!ok) return
      const v = form.getValues()
      if (electionId) {
        try {
          await persistNow(v, electionId)
        } catch (e: any) {
          toast.error(e.message || 'Failed to save voter limit settings')
          return
        }
      }
      setStep(3)
    } else if (step === 3) {
      if (!electionId) return
      if (polls.length === 0) {
        toast.error('Add at least one ballot section.')
        return
      }
      await loadPollsAndCounts(electionId)
      setStep(4)
    }
  }

  const goBack = () => setStep(Math.max(0, step - 1))

  const addPoll = async () => {
    if (!electionId || !pollTitle.trim()) return
    try {
      await pollsService.create({
        election_id: electionId,
        title: pollTitle.trim(),
        display_order: polls.length,
      })
      setPollTitle('')
      await loadPollsAndCounts(electionId)
      toast.success('Section added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add section')
    }
  }

  const removePoll = async (p: Poll) => {
    if (polls.length <= 1) {
      toast.error('At least one section is required.')
      return
    }
    if ((candidatesByPoll[p.id] ?? 0) > 0) {
      toast.error('Remove all candidates from this section first.')
      return
    }
    try {
      await pollsService.delete(p.id)
      if (electionId) await loadPollsAndCounts(electionId)
      toast.success('Section removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove')
    }
  }

  const togglePollComments = async (p: Poll, checked: boolean) => {
    try {
      await pollsService.update(p.id, { allow_comments: checked })
      setPolls(polls.map(poll => poll.id === p.id ? { ...poll, allow_comments: checked } : poll))
    } catch (e) {
      toast.error('Failed to update comment settings')
    }
  }

  const submitForApproval = async () => {
    if (!electionId || !profile?.id) return
    try {
      // Fetch fresh data directly to bypass state sync delays
      const [plist, clist] = await Promise.all([
        pollsService.list(electionId),
        electionsService.listCandidates(electionId)
      ])
      
      // Update local state too
      setPolls(plist)
      const map: Record<string, number> = {}
      for (const c of clist) {
        map[c.poll_id] = (map[c.poll_id] ?? 0) + 1
      }
      setCandidatesByPoll(map)
      
      // Validate using the fresh data
      if (plist.length === 0) {
        toast.error('Add at least one ballot section.')
        return
      }

      for (const p of plist) {
        const n = map[p.id] ?? 0
        if (n < 2) {
          toast.error(`Section "${p.title}" needs at least two candidates (Found: ${n}).`)
          return
        }
      }

      // ── Already approved: just save the current field values and return ──
      if (election?.status === 'approved') {
        const v = form.getValues()
        await persistNow(v, electionId)
        await auditService.log('election.updated', 'election', electionId, { source: 'wizard_review' })
        toast.success('Changes saved! Your election remains approved and live.')
        void navigate(ROUTES.electionCreatorView(electionId))
        return
      }

      // Check if user is super admin to bypass approval
      if (profile.role === 'super_admin') {
        await electionsService.approve(electionId, profile.id)
        await auditService.log('election.published_directly', 'election', electionId, {})
        toast.success('Election is now LIVE and visible to voters!')
      } else {
        // Set to pending_approval and notify admins
        await electionsService.update(electionId, { status: 'pending_approval' })
        await notificationsService.notifyAdmins(
          'New Election Approval Request',
          `"${plist[0]?.title ?? 'Election'}" needs your review before it can go live.`,
          ROUTES.adminElections
        )
        await auditService.log('election.submitted_for_approval', 'election', electionId, {})
        toast.success('Submitted! Your election is now pending admin approval.')
      }
      
      void navigate(ROUTES.electionCreatorView(electionId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish')
    }
  }

  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step])

  if (!isCreate && loadingElection) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-10 animate-spin text-primary" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Loading Election Builder</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-32 px-4 sm:px-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:pb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{isCreate ? 'Create New Election' : election?.title}</h1>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Follow the steps to set up your election campaigns.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg font-semibold border-border shrink-0 text-xs" asChild>
            <Link to={ROUTES.creatorDashboard}>Back</Link>
          </Button>
        </div>
      </div>

      {/* Progress System */}
      <div className="space-y-4">
        <div className="flex justify-between items-start gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1.5 flex-1">
              <div className={cn(
                "size-8 sm:size-9 rounded-lg flex items-center justify-center border transition-all duration-500 font-bold text-[10px] sm:text-xs",
                i === step 
                  ? "bg-primary border-primary text-white shadow-sm scale-110" 
                  : i < step 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" 
                    : "bg-muted border-border text-muted-foreground"
              )}>
                {i < step ? <ShieldCheck className="size-3.5 sm:size-4" /> : i + 1}
              </div>
              <span className={cn(
                "text-[7px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest transition-colors duration-500 text-center leading-tight",
                i === step ? "text-primary" : "text-muted-foreground"
              )}>
                {s}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1.5 sm:h-2 overflow-hidden rounded-full bg-muted border border-border">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.4 }}
        >
          {step === 0 ? (
            <Card className="rounded-2xl sm:rounded-[2rem] border-border bg-card shadow-sm">
              <CardHeader className="p-5 sm:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground">Basic Information</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground font-medium">Provide the core details about your election event.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8 lg:p-10 pt-0 space-y-6 sm:space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Election Title</Label>
                  <Input id="title" placeholder="e.g. Board of Directors 2026" className="h-14 rounded-xl bg-muted/50 border-border text-lg font-bold tracking-tight focus:ring-primary/20" {...form.register('title')} disabled={election?.status === 'approved'} />
                  {form.formState.errors.title ? (
                    <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.title.message}</p>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Detailed Description</Label>
                  <Controller
                    name="descriptionHtml"
                    control={form.control}
                    render={({ field }) => (
                      <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
                        <RichTextField value={field.value} onChange={field.onChange} disabled={form.formState.isSubmitting || election?.status === 'approved'} />
                      </div>
                    )}
                  />
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="category" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Category</Label>
                    <Input id="category" placeholder="e.g. Internal" className="h-14 rounded-xl bg-muted/50 border-border font-bold" {...form.register('category')} disabled={election?.status === 'approved'} />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="organization" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Organization</Label>
                    <Input
                      id="organization"
                      placeholder="e.g. My Company Inc."
                      className="h-14 rounded-xl bg-muted/50 border-border font-bold"
                      {...form.register('organization')}
                      disabled={election?.status === 'approved'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 1 ? (
            <Card className="rounded-2xl sm:rounded-[2rem] border-border bg-card shadow-sm">
              <CardHeader className="p-5 sm:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground">Schedule & Timing</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground font-medium">Define when people can register and cast their votes.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8 lg:p-10 pt-0 space-y-6 sm:space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="startsAt" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Voting Opens</Label>
                    <Input id="startsAt" type="datetime-local" className="h-14 rounded-xl bg-muted/50 border-border font-bold" {...form.register('startsAt')} />
                    {form.formState.errors.startsAt ? (
                      <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.startsAt.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="endsAt" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Voting Closes</Label>
                    <Input id="endsAt" type="datetime-local" className="h-14 rounded-xl bg-muted/50 border-border font-bold" {...form.register('endsAt')} />
                    {form.formState.errors.endsAt ? (
                      <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.endsAt.message}</p>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label htmlFor="ro" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Registration Starts</Label>
                    <Input id="ro" type="datetime-local" className="h-14 rounded-xl bg-muted/50 border-border font-bold" {...form.register('registrationOpensAt')} />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="rc" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Registration Ends</Label>
                    <Input id="rc" type="datetime-local" className="h-14 rounded-xl bg-muted/50 border-border font-bold" {...form.register('registrationClosesAt')} />
                    {form.formState.errors.registrationClosesAt ? (
                      <p className="text-xs font-bold text-rose-500 ml-1">{form.formState.errors.registrationClosesAt.message}</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card className="rounded-2xl sm:rounded-[2rem] border-border bg-card shadow-sm">
              <CardHeader className="p-5 sm:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground">Voter Access</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground font-medium">Control who can see and participate in this election.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8 lg:p-10 pt-0 space-y-6 sm:space-y-8">
                <div className="space-y-3">
                  <Label htmlFor="mv" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Maximum Participant Count</Label>
                  <Input
                    id="mv"
                    type="number"
                    min={1}
                    className="h-14 rounded-xl bg-muted/50 border-border font-bold"
                    placeholder="Leave blank for no limit"
                    {...form.register('maxVoters')}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Visibility Level</Label>
                  <Controller
                    name="visibility"
                    control={form.control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          type="button"
                          variant={field.value === 'public' ? 'default' : 'outline'}
                          className={cn("h-20 rounded-2xl font-bold flex flex-col gap-1", field.value === 'public' ? 'premium-gradient shadow-sm' : 'bg-muted/50 border-border')}
                          onClick={() => field.onChange('public')}
                        >
                          <span className="text-base">Public</span>
                          <span className="text-[9px] uppercase opacity-60">Visible to everyone</span>
                        </Button>
                        <Button
                          type="button"
                          variant={field.value === 'private' ? 'default' : 'outline'}
                          className={cn("h-20 rounded-2xl font-bold flex flex-col gap-1", field.value === 'private' ? 'premium-gradient shadow-sm' : 'bg-muted/50 border-border')}
                          onClick={() => field.onChange('private')}
                        >
                          <span className="text-base">Private</span>
                          <span className="text-[9px] uppercase opacity-60">Link required to view</span>
                        </Button>
                      </div>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 3 && electionId ? (
            <Card className="rounded-2xl sm:rounded-[2rem] border-border bg-card shadow-sm">
              <CardHeader className="p-5 sm:p-8 lg:p-10">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-base sm:text-lg font-bold text-foreground">Ballot Structure</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground font-medium">
                  Add the positions or categories voters will be deciding on.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8 lg:p-10 pt-0 space-y-8 sm:space-y-10">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Input
                    value={pollTitle}
                    onChange={(e) => setPollTitle(e.target.value)}
                    placeholder="Section Title (e.g. Board Member)"
                    className="h-14 rounded-xl bg-muted/50 border-border text-base font-bold flex-1"
                    disabled={election?.status === 'approved'}
                  />
                  <Button type="button" className="h-14 rounded-xl premium-gradient px-8 font-bold uppercase tracking-widest text-[10px] gap-2 shadow-sm" onClick={() => void addPoll()} disabled={election?.status === 'approved'}>
                    <Plus className="size-4" strokeWidth={3} /> Add Section
                  </Button>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Added Sections</p>
                  <ul className="space-y-3">
                    {polls.length === 0 && (
                      <div className="p-12 rounded-2xl border border-dashed border-border bg-muted/10 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">No sections added yet</p>
                      </div>
                    )}
                    {polls.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-6 rounded-2xl border border-border bg-muted/30 p-5 group hover:bg-muted/50 transition-all"
                      >
                        <div className="flex flex-col gap-4 flex-1">
                          <div className="flex items-center gap-4">
                            <div className="size-10 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                              <Activity className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-lg font-bold text-foreground tracking-tight">{p.title}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{candidatesByPoll[p.id] ?? 0} Candidates</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-background/50 p-2.5 rounded-xl border border-border/50">
                            <Switch 
                              id={`comments-${p.id}`}
                              checked={p.allow_comments}
                              onCheckedChange={(checked) => void togglePollComments(p, checked)}
                              disabled={election?.status === 'approved'}
                            />
                            <Label htmlFor={`comments-${p.id}`} className="text-xs font-bold text-muted-foreground cursor-pointer">
                              Allow voters to leave comments for this section
                            </Label>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start mt-2">
                          <Button asChild size="sm" variant="ghost" className="h-9 rounded-lg hover:bg-primary/10 hover:text-primary font-bold text-xs">
                            <Link to={ROUTES.electionCandidates(electionId)}>Candidates</Link>
                          </Button>
                          {election?.status !== 'approved' ? (
                            <Button type="button" size="icon" variant="ghost" className="size-9 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-all" onClick={() => void removePoll(p)}>
                              <Trash2 className="size-4" />
                            </Button>
                          ) : (
                            <span className="text-[9px] font-bold uppercase text-muted-foreground bg-muted border border-border px-3 py-1.5 rounded-lg select-none">Approved</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 4 && electionId ? (
            <Card className="rounded-2xl sm:rounded-[2rem] border-border bg-card shadow-sm">
              <CardHeader className="p-5 sm:p-8 lg:p-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-9 sm:size-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="size-4 sm:size-5 text-emerald-600" />
                  </div>
                  <CardTitle className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">Review & Finalize</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground font-medium text-sm sm:text-base">Check everything carefully before publishing.</CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-8 lg:p-10 pt-0 space-y-8 sm:space-y-10">
                {election?.status === 'approved' && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      This election is already approved. Your changes will be saved immediately — no re-approval needed.
                    </p>
                  </div>
                )}
                <div className="rounded-2xl border border-border bg-muted/30 p-8 space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</p>
                    <p className="text-base font-bold text-foreground">{form.getValues('title')}</p>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sections</p>
                    <p className="text-base font-bold text-foreground">{polls.length} Total</p>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Candidates</p>
                    <p className="text-base font-bold text-foreground">{Object.values(candidatesByPoll).reduce((a, b) => a + b, 0)} Total</p>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visibility</p>
                    <p className="text-base font-bold text-foreground capitalize">{form.getValues('visibility')}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Voter Limit</p>
                    <p className="text-base font-bold text-foreground">{form.getValues('maxVoters') || 'None'}</p>
                  </div>
                </div>
                <div className="flex flex-col lg:flex-row gap-4">
                  <Button type="button" className="h-14 rounded-xl premium-gradient px-10 font-bold uppercase tracking-widest text-[10px] shadow-lg flex-1" onClick={() => void submitForApproval()}>
                    {election?.status === 'approved' ? 'Save Changes' : 'Publish Now'}
                  </Button>
                  <Button type="button" variant="outline" className="h-14 rounded-xl border-border bg-background hover:bg-muted px-10 font-bold uppercase tracking-widest text-[10px] flex-1" asChild>
                    <Link to={ROUTES.electionDetail(electionId)}>View Preview</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between items-center">
        <Button type="button" variant="outline" className="rounded-xl border-border bg-background hover:bg-muted h-11 sm:h-12 px-4 sm:px-6 font-bold uppercase tracking-widest text-[10px] gap-2 disabled:opacity-20 transition-all" disabled={step === 0} onClick={goBack}>
          <ChevronLeft className="size-4" strokeWidth={3} /> <span className="hidden xs:inline">Previous</span>
        </Button>
        {step < 4 ? (
          <Button type="button" className="rounded-xl premium-gradient h-11 sm:h-12 px-6 sm:px-8 font-bold uppercase tracking-widest text-[10px] gap-2 shadow-sm hover:scale-105 transition-all" onClick={() => void goNext()}>
            Next <ChevronRight className="size-4" strokeWidth={3} />
          </Button>
        ) : null}
      </div>

      {import.meta.env.DEV && (
        <div className="fixed bottom-4 right-4 z-50 rounded-2xl bg-black/80 p-4 text-[10px] text-zinc-500 backdrop-blur-xl border border-zinc-800 font-mono">
          <p>Role: {profile?.role}</p>
          <p>Election ID: {electionId || 'None'}</p>
          <p>Form Valid: {form.formState.isValid ? 'Yes' : 'No'}</p>
          <p>Step: {step}</p>
        </div>
      )}
    </div>
  )
}
