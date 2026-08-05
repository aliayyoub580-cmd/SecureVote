import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ROUTES } from '@/constants/routes'
import { electionsService } from '@/services/elections.service'
import { pollsService } from '@/services/polls.service'
import type { Database } from '@/types/database'

type Candidate = Database['public']['Tables']['election_candidates']['Row']

export function CandidatePreviewPage() {
  const { id: electionId, candidateId } = useParams<{ id: string; candidateId: string }>()
  const [loading, setLoading] = useState(true)
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [pollTitle, setPollTitle] = useState('')
  const [electionTitle, setElectionTitle] = useState('')

  useEffect(() => {
    if (!electionId || !candidateId) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [election, row, polls] = await Promise.all([
          electionsService.getById(electionId),
          electionsService.getCandidate(electionId, candidateId),
          pollsService.list(electionId),
        ])
        if (cancelled) return
        setElectionTitle(election?.title ?? '')
        setCandidate(row)
        const pol = polls.find((p) => p.id === row?.poll_id)
        setPollTitle(pol?.title ?? 'Ballot section')
      } catch {
        if (!cancelled) setCandidate(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [electionId, candidateId])

  if (!electionId || !candidateId) return null

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (!candidate) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to={ROUTES.electionCandidates(electionId)}>
            <ArrowLeft className="mr-2 size-4" />
            Back to candidates
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Not found</CardTitle>
            <CardDescription>This candidate does not exist on this election.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const initials = candidate.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <motion.div
      className="mx-auto max-w-2xl space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm" className="rounded-xl">
          <Link to={ROUTES.electionCandidates(electionId)}>
            <ArrowLeft className="mr-2 size-4" />
            Candidates
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="rounded-xl text-muted-foreground">
          <Link to={ROUTES.electionDetail(electionId)}>{electionTitle}</Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-border/50 bg-card/90 shadow-card backdrop-blur-md">
        <CardHeader className="space-y-4 sm:flex-row sm:items-start sm:gap-6">
          <Avatar className="mx-auto size-28 rounded-3xl border border-border/60 sm:mx-0 sm:size-32">
            {candidate.image_path ? (
              <AvatarImage src={candidate.image_path} alt="" className="rounded-3xl object-cover" />
            ) : null}
            <AvatarFallback className="rounded-3xl text-2xl font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{pollTitle}</p>
            <CardTitle className="text-2xl sm:text-3xl">{candidate.name}</CardTitle>
            {candidate.designation ? (
              <p className="text-base font-medium text-muted-foreground">{candidate.designation}</p>
            ) : null}
            {candidate.bio ? <CardDescription className="text-base text-foreground/80">{candidate.bio}</CardDescription> : null}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Manifesto</h2>
          {candidate.manifesto ? (
            <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {candidate.manifesto}
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No manifesto provided.</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
