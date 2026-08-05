import type { ElectionLiveStats, ResultRow } from '@/services/votes.service'

export type PollSection = {
  pollTitle: string
  pollId: string | undefined
  rows: ResultRow[]
}

export function groupResultsByPoll(rows: ResultRow[]): PollSection[] {
  const m = new Map<string, { pollTitle: string; pollId: string | undefined; rows: ResultRow[] }>()
  for (const r of rows) {
    const title = r.poll_title ?? 'Results'
    const key = `${r.poll_id ?? title}`
    const cur = m.get(key) ?? { pollTitle: title, pollId: r.poll_id, rows: [] as ResultRow[] }
    cur.rows.push(r)
    if (r.poll_id) cur.pollId = r.poll_id
    m.set(key, cur)
  }
  return [...m.values()].map((v) => ({ ...v, rows: [...v.rows].sort((a, b) => b.votes - a.votes) }))
}

export type PollWinnerInfo = {
  pollTitle: string
  pollId: string | undefined
  /** Leading candidate(s); multiple if tie at top with votes > 0 */
  leaders: { candidate_id: string; name: string; votes: number }[]
  isTie: boolean
  totalVotesInPoll: number
}

export function computePollWinners(sections: PollSection[]): PollWinnerInfo[] {
  return sections.map((s) => {
    const total = s.rows.reduce((acc, r) => acc + r.votes, 0)
    const maxV = s.rows.length ? Math.max(...s.rows.map((r) => r.votes)) : 0
    const leaders = s.rows
      .filter((r) => r.votes === maxV && maxV > 0)
      .map((r) => ({ candidate_id: r.candidate_id, name: r.name, votes: r.votes }))
    return {
      pollTitle: s.pollTitle,
      pollId: s.pollId,
      leaders,
      isTie: leaders.length > 1,
      totalVotesInPoll: total,
    }
  })
}

export function sumVoteRows(rows: ResultRow[]): number {
  return rows.reduce((s, r) => s + r.votes, 0)
}

/** Participation: completed ballots vs issued ballot tokens. */
export function turnoutParticipationPercent(stats: ElectionLiveStats): number {
  if (stats.registered <= 0) return 0
  return Math.min(100, Math.round((100 * stats.ballots_completed) / stats.registered))
}

/** Cap progress when election has max_voters */
export function turnoutVsCapPercent(stats: ElectionLiveStats, maxVoters: number | null): number | null {
  if (maxVoters == null || maxVoters <= 0) return null
  return Math.min(100, Math.round((100 * stats.ballots_completed) / maxVoters))
}

export type ElectionInsight = { id: string; title: string; body: string; tone: 'neutral' | 'positive' | 'attention' }

export function buildElectionInsights(params: {
  sections: PollSection[]
  winners: PollWinnerInfo[]
  stats: ElectionLiveStats | null
  phaseLabel: string
}): ElectionInsight[] {
  const { sections, winners, stats, phaseLabel } = params
  const out: ElectionInsight[] = []

  out.push({
    id: 'phase',
    title: 'Election status',
    body: `Results reflect the current phase (${phaseLabel}). Tallies are anonymous; only aggregate counts are shown.`,
    tone: 'neutral',
  })

  if (stats && stats.registered > 0) {
    const p = turnoutParticipationPercent(stats)
    out.push({
      id: 'turnout',
      title: 'Participation',
      body: `${p}% of issued ballots have been submitted (${stats.ballots_completed} of ${stats.registered}).`,
      tone: p >= 50 ? 'positive' : 'neutral',
    })
  }

  for (const w of winners) {
    if (w.totalVotesInPoll === 0) {
      out.push({
        id: `empty-${w.pollTitle}`,
        title: w.pollTitle,
        body: 'No votes recorded in this section yet.',
        tone: 'attention',
      })
      continue
    }
    if (w.leaders.length === 1) {
      const L = w.leaders[0]
      out.push({
        id: `lead-${w.pollId ?? w.pollTitle}`,
        title: w.pollTitle,
        body: `${L.name} leads with ${L.votes} vote${L.votes === 1 ? '' : 's'} (${Math.round((100 * L.votes) / w.totalVotesInPoll)}% of this section).`,
        tone: 'positive',
      })
    } else if (w.isTie) {
      const names = w.leaders.map((l) => l.name).join(', ')
      out.push({
        id: `tie-${w.pollId ?? w.pollTitle}`,
        title: w.pollTitle,
        body: `Tie for first place between ${names}, each with ${w.leaders[0]?.votes ?? 0} votes.`,
        tone: 'attention',
      })
    }
  }

  for (const w of winners) {
    if (w.leaders.length !== 1 || w.totalVotesInPoll === 0) continue
    const sec = sections.find((s) => s.pollTitle === w.pollTitle || (w.pollId != null && s.pollId === w.pollId))
    const sorted = sec?.rows ?? []
    if (sorted.length < 2) continue
    const [first, second] = sorted
    if (!first || !second || first.votes === second.votes) continue
    const margin = first.votes - second.votes
    if (margin <= 0) continue
    out.push({
      id: `margin-${w.pollId ?? w.pollTitle}`,
      title: `${w.pollTitle} margin`,
      body: `Runner-up trails by ${margin} vote${margin === 1 ? '' : 's'}.`,
      tone: 'neutral',
    })
  }

  return out.slice(0, 14)
}
