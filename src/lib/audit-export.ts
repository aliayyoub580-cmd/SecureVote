import { format } from 'date-fns'

import type { Database } from '@/types/database'

type AuditRow = Database['public']['Tables']['audit_logs']['Row']

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Opens a print dialog so the user can save as PDF (browser “Save as PDF”). */
export function printAuditLogsReport(rows: AuditRow[], reportTitle: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return

  const rowsHtml = rows
    .map(
      (r) => `<tr>
      <td>${escapeHtml(format(new Date(r.created_at), 'yyyy-MM-dd HH:mm:ss'))}</td>
      <td>${escapeHtml(r.category ?? '')}</td>
      <td><code>${escapeHtml(r.action)}</code></td>
      <td>${escapeHtml(r.resource_type)}</td>
      <td><code>${escapeHtml(r.resource_id ?? '')}</code></td>
      <td><code>${escapeHtml(r.actor_id ?? '')}</code></td>
      <td>${escapeHtml(r.ip_address ?? '')}</td>
      <td>${escapeHtml((r.device_label ?? '').slice(0, 40))}</td>
      <td><pre style="white-space:pre-wrap;font-size:9px;margin:0">${escapeHtml(JSON.stringify(r.metadata, null, 0))}</pre></td>
    </tr>`,
    )
    .join('')

  w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(reportTitle)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 8px; }
  p.meta { font-size: 12px; color: #444; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px; vertical-align: top; text-align: left; }
  th { background: #f4f4f4; }
  code { font-size: 10px; word-break: break-all; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>${escapeHtml(reportTitle)}</h1>
  <p class="meta">Generated ${escapeHtml(format(new Date(), 'PPpp'))} · ${rows.length} row(s)</p>
  <table>
    <thead><tr>
      <th>When (local)</th><th>Category</th><th>Action</th><th>Resource type</th>
      <th>Resource id</th><th>Actor</th><th>IP</th><th>Device</th><th>Metadata</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`)
  w.document.close()
}

export function downloadAuditCsv(rows: AuditRow[], filename: string) {
  const headers = [
    'created_at',
    'category',
    'action',
    'resource_type',
    'resource_id',
    'actor_id',
    'ip_address',
    'device_label',
    'user_agent',
    'metadata',
  ]
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        r.created_at,
        r.category ?? '',
        r.action,
        r.resource_type,
        r.resource_id ?? '',
        r.actor_id ?? '',
        r.ip_address ?? '',
        r.device_label ?? '',
        r.user_agent ?? '',
        JSON.stringify(r.metadata).replaceAll('"', '""'),
      ]
        .map((cell) => `"${String(cell)}"`)
        .join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
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
