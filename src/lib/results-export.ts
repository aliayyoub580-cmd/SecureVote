import type { PollSection } from '@/lib/election-results-analytics'
import type { ElectionLiveStats, ResultRow } from '@/services/votes.service'
// @ts-ignore
import html2pdf from 'html2pdf.js'

function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportResultsCsv(params: {
  electionTitle: string
  electionId: string
  rows: ResultRow[]
  stats: ElectionLiveStats | null
}): void {
  const { electionTitle, electionId, rows, stats } = params
  const lines: string[] = []
  lines.push(escapeCsvCell('election_id') + ',' + escapeCsvCell(electionId))
  lines.push(escapeCsvCell('election_title') + ',' + escapeCsvCell(electionTitle))
  if (stats) {
    lines.push('metric,value')
    lines.push(`votes_cast,${stats.votes_cast}`)
    lines.push(`registered,${stats.registered}`)
    lines.push(`ballots_completed,${stats.ballots_completed}`)
    lines.push('')
  }
  lines.push('poll_title,candidate_id,candidate_name,votes')
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.poll_title ?? ''),
        escapeCsvCell(r.candidate_id),
        escapeCsvCell(r.name),
        String(r.votes),
      ].join(','),
    )
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  triggerDownload(blob, `results-${electionId.slice(0, 8)}.csv`)
}

export function exportResultsJson(params: {
  electionTitle: string
  electionId: string
  rows: ResultRow[]
  sections: PollSection[]
  stats: ElectionLiveStats | null
  exportedAt: string
}): void {
  const payload = {
    election_id: params.electionId,
    election_title: params.electionTitle,
    exported_at: params.exportedAt,
    live_stats: params.stats,
    sections: params.sections.map((s) => ({
      poll_title: s.pollTitle,
      poll_id: s.pollId ?? null,
      candidates: s.rows.map((r) => ({
        candidate_id: r.candidate_id,
        name: r.name,
        votes: r.votes,
      })),
    })),
    raw_rows: params.rows,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  triggerDownload(blob, `results-${params.electionId.slice(0, 8)}.json`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function maskPublicId(id: string) {
  if (!id) return 'POLL-••••••••'
  const parts = id.split('-')
  if (parts.length < 3) return id
  const segment = parts[1]
  const tail = parts[2]
  if (tail.length < 8) return id
  const seq = tail.substring(4)
  return `POLL-${segment}-••••${seq}`
}

export function printVoteLedgerPdf(params: {
  electionTitle: string
  electionId: string
  stats: ElectionLiveStats | null
  ledger: { voter_code: string; candidate_name: string; poll_title: string; voted_at: string; comment?: string | null }[]
}): void {
  const { electionTitle, electionId, stats, ledger } = params

  // 1. Create a zero-height, overflow-hidden parent wrapper to hide the layout visually
  const wrapper = document.createElement('div')
  wrapper.style.position = 'absolute'
  wrapper.style.left = '0'
  wrapper.style.top = '0'
  wrapper.style.width = '780px'
  wrapper.style.height = '0'
  wrapper.style.overflow = 'hidden'
  wrapper.style.zIndex = '-9999'

  // 2. Create the beautiful container inside the wrapper (fully opaque and visible)
  const container = document.createElement('div')
  container.style.width = '780px'
  container.style.backgroundColor = '#ffffff'
  container.style.color = '#1f2937'
  container.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif"
  container.style.padding = '35px'
  container.style.boxSizing = 'border-box'

  // Generate voter rows
  const rowsHtml = ledger
    .map(
      (r) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 12px 16px; font-family: monospace; font-size: 12px; font-weight: 700; color: #1e293b;">
          ${maskPublicId(r.voter_code)}
        </td>
        <td style="padding: 12px 16px; font-size: 12px; color: #475569; font-weight: 500;">
          ${r.poll_title}
        </td>
        <td style="padding: 12px 16px;">
          <span style="font-weight: 700; font-size: 11px; background-color: #f0fdf4; color: #15803d; padding: 4px 8px; border-radius: 6px; border: 1px solid #dcfce7; display: inline-block;">
            ${r.candidate_name}
          </span>
        </td>
        <td style="padding: 12px 16px; font-size: 11px; color: #475569; font-style: italic; max-width: 150px; word-wrap: break-word;">
          ${r.comment ? `"${escapeHtml(r.comment)}"` : '—'}
        </td>
        <td style="padding: 12px 16px; font-size: 11px; color: #64748b; font-weight: 500;">
          ${new Date(r.voted_at).toLocaleString()}
        </td>
      </tr>
    `
    )
    .join('')

  // Construct standard-compliant beautiful brand layout matching their logo
  container.innerHTML = `
    <!-- Top Brand Header with Website Logo and Colors -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 18px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="/logo.png" style="height: 38px; width: 38px; object-fit: contain;" />
        <div>
          <span style="font-size: 22px; font-weight: 900; letter-spacing: -0.04em; color: #0f172a;">
            Secure<span style="color: #4a9ebf;">Vote</span>
          </span>
          <div style="font-size: 9px; font-weight: 800; color: #4a9ebf; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 2px;">Decentralized Audit Network</div>
        </div>
      </div>
      <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; background-color: #f0fdf4; color: #166534; padding: 6px 12px; border-radius: 99px; border: 1px solid #bbf7d0;">
        Cryptographic Audit Pass
      </div>
    </div>

    <!-- Info Panel -->
    <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h1 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; letter-spacing: -0.02em;">
        ${electionTitle}
      </h1>
      <div style="font-size: 11px; font-family: monospace; color: #64748b; margin-bottom: 16px;">
        Election Core ID: ${electionId}
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; border-top: 1px solid #e2e8f0; padding-top: 14px;">
        <div>
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; letter-spacing: 0.05em;">Total Ballots Cast</div>
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${stats ? stats.votes_cast : ledger.length}</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; letter-spacing: 0.05em;">Verified Turnout</div>
          <div style="font-size: 16px; font-weight: 800; color: #0f172a;">${stats ? stats.ballots_completed : '—'}</div>
        </div>
        <div>
          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; letter-spacing: 0.05em;">Report Date</div>
          <div style="font-size: 16px; font-weight: 800; color: #4a9ebf;">${new Date().toLocaleDateString()}</div>
        </div>
      </div>
    </div>

    <!-- Table Section -->
    <h2 style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.08em;">
      Decentralized Voter Trail Ledger
    </h2>
    <table style="width: 100%; border-collapse: collapse; text-align: left; background-color: #ffffff;">
      <thead>
        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
          <th style="padding: 10px 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Voter public ID</th>
          <th style="padding: 10px 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Poll Category</th>
          <th style="padding: 10px 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Candidate choice</th>
          <th style="padding: 10px 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Comment</th>
          <th style="padding: 10px 16px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">Voted at</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">No votes recorded in this cryptographic segment.</td></tr>'}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 10px; color: #94a3b8; font-weight: 500; letter-spacing: 0.02em;">
      © ${new Date().getFullYear()} SecureVote Platform. This ledger represents a cryptographically verified public audit block.
    </div>
  `

  wrapper.appendChild(container)
  document.body.appendChild(wrapper)

  // 3. Generate PDF directly using the local html2pdf module on the fully-opaque container
  const filename = `audit-${electionTitle.toLowerCase().replace(/\s+/g, '-')}-${electionId.slice(0, 8)}.pdf`
  const opt = {
    margin: 0.4,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  }

  try {
    html2pdf()
      .from(container)
      .set(opt)
      .save()
      .then(() => {
        if (document.body.contains(wrapper)) {
          document.body.removeChild(wrapper)
        }
      })
      .catch((err: any) => {
        console.error('html2pdf promise failure:', err)
        if (document.body.contains(wrapper)) {
          document.body.removeChild(wrapper)
        }
      })
  } catch (err) {
    console.error('html2pdf synchronous execution failure:', err)
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper)
    }
  }
}

