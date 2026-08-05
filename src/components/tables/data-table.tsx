import type { ReactNode } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type Column<T> = {
  id: string
  header: string | (() => ReactNode)
  cell: (row: T) => ReactNode
  className?: string
}

type DataTableProps<T> = {
  columns: Column<T>[]
  data: T[]
  getRowId: (row: T) => string
  empty?: ReactNode
  className?: string
}

export function DataTable<T>({ columns, data, getRowId, empty, className }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-12 text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{empty ?? 'No data entries found'}</p>
      </div>
    )
  }

  return (
    <div className={cn("premium-card overflow-hidden", className)}>
      <Table>
        <TableHeader className="bg-muted/30 border-b border-border">
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.id} className={cn("h-11 px-6 text-[10px] font-bold uppercase tracking-wider text-muted-foreground", c.className)}>
                {typeof c.header === 'function' ? c.header() : c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow 
              key={getRowId(row)} 
              className="h-14 border-b border-border/50 hover:bg-muted/30 transition-colors"
            >
              {columns.map((c) => (
                <TableCell key={c.id} className={cn("px-6 text-sm font-medium text-foreground", c.className)}>
                  {c.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

