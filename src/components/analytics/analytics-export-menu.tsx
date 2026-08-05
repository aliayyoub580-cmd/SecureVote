import { Download, FileJson, FileSpreadsheet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { PollSection } from '@/lib/election-results-analytics'
import { exportResultsCsv, exportResultsJson } from '@/lib/results-export'
import type { ElectionLiveStats, ResultRow } from '@/services/votes.service'

type Props = {
  electionId: string
  electionTitle: string
  rows: ResultRow[]
  sections: PollSection[]
  stats: ElectionLiveStats | null
}

export function AnalyticsExportMenu({ electionId, electionTitle, rows, sections, stats }: Props) {
  const exportedAt = new Date().toISOString()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2 border-border/60 bg-card/50 backdrop-blur-sm">
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Download snapshot</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onSelect={() =>
            exportResultsCsv({
              electionId,
              electionTitle,
              rows,
              stats,
            })
          }
        >
          <FileSpreadsheet className="size-4" />
          CSV (flat rows)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          onSelect={() =>
            exportResultsJson({
              electionId,
              electionTitle,
              rows,
              sections,
              stats,
              exportedAt,
            })
          }
        >
          <FileJson className="size-4" />
          JSON (structured)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
