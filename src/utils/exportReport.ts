/**
 * ExportDiffReport — Generate HTML / PDF diff reports
 * Uses the same row-building logic as TextDiffView.vue
 */
import type { DiffResult } from '@/types'

export interface DiffExportOptions {
  title: string
  leftLabel: string
  rightLabel: string
  diffResult: DiffResult | null
  leftContent: string
  rightContent: string
  stats?: { same: number; added: number; deleted: number; modified: number }
  theme?: 'dark' | 'light'
}

/** Escape HTML special characters */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build diff rows from DiffResult using the same algorithm as TextDiffView */
function buildRows(result: DiffResult): Array<{ li: number | null; ri: number | null; lt: string; rt: string; st: 'equal' | 'delete' | 'insert' | 'replace' }> {
  const { ops, left_lines: LL, right_lines: RL } = result
  const rows: Array<{ li: number | null; ri: number | null; lt: string; rt: string; st: 'equal' | 'delete' | 'insert' | 'replace' }> = []
  for (const op of ops) {
    if ('Equal' in op) {
      for (let i = 0; i < op.Equal.count; i++) {
        rows.push({ li: null, ri: null, lt: '', rt: '', st: 'equal' })
      }
    } else if ('Delete' in op) {
      for (let i = 0; i < op.Delete.count; i++) {
        rows.push({ li: null, ri: null, lt: '', rt: '', st: 'delete' })
      }
    } else if ('Insert' in op) {
      for (let i = 0; i < op.Insert.count; i++) {
        rows.push({ li: null, ri: null, lt: '', rt: '', st: 'insert' })
      }
    } else if ('Replace' in op) {
      const max = Math.max(op.Replace.left_count, op.Replace.right_count)
      for (let i = 0; i < max; i++) {
        rows.push({ li: null, ri: null, lt: '', rt: '', st: 'replace' })
      }
    }
  }
  // Now fill in actual line content using manual tracking
  let li = 0, ri = 0
  const filled: Array<{ li: number | null; ri: number | null; lt: string; rt: string; st: 'equal' | 'delete' | 'insert' | 'replace' }> = []
  for (const op of ops) {
    if ('Equal' in op) {
      for (let i = 0; i < op.Equal.count; i++) {
        filled.push({ li: li, ri: ri, lt: LL[li] ?? '', rt: RL[ri] ?? '', st: 'equal' })
        li++; ri++
      }
    } else if ('Delete' in op) {
      for (let i = 0; i < op.Delete.count; i++) {
        filled.push({ li: li, ri: null, lt: LL[li] ?? '', rt: '', st: 'delete' })
        li++
      }
    } else if ('Insert' in op) {
      for (let i = 0; i < op.Insert.count; i++) {
        filled.push({ li: null, ri: ri, lt: '', rt: RL[ri] ?? '', st: 'insert' })
        ri++
      }
    } else if ('Replace' in op) {
      const max = Math.max(op.Replace.left_count, op.Replace.right_count)
      for (let i = 0; i < max; i++) {
        const hasLeft = i < op.Replace.left_count
        const hasRight = i < op.Replace.right_count
        filled.push({
          li: hasLeft ? li + i : null,
          ri: hasRight ? ri + i : null,
          lt: hasLeft ? LL[li + i] ?? '' : '',
          rt: hasRight ? RL[ri + i] ?? '' : '',
          st: 'replace',
        })
      }
      li += op.Replace.left_count
      ri += op.Replace.right_count
    }
  }
  return filled
}

/** Generate a self-contained HTML diff report */
export function exportDiffAsHtml(opts: DiffExportOptions): string {
  const { title, leftLabel, rightLabel, diffResult, stats, theme = 'dark' } = opts

  const isDark = theme === 'dark'
  const bg = isDark ? '#18181b' : '#f8fafc'
  const surface = isDark ? '#27272a' : '#ffffff'
  const border = isDark ? '#3f3f46' : '#cbd5e1'
  const text = isDark ? '#f4f4f5' : '#0f172a'
  const muted = isDark ? '#a1a1aa' : '#64748b'
  const green = isDark ? '#22c55e' : '#16a34a'
  const red = isDark ? '#ef4444' : '#dc2626'
  const blue = isDark ? '#3b82f6' : '#2563eb'
  const rowHover = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'

  const rows: string[] = []
  if (diffResult) {
    const filled = buildRows(diffResult)
    let lineNum = 0
    for (const row of filled) {
      const cls = row.st === 'equal' ? 'row-eq' : row.st === 'insert' ? 'row-ins' : row.st === 'delete' ? 'row-del' : 'row-rep'
      const lt = esc(row.lt)
      const rt = esc(row.rt)
      const liDisplay = row.li !== null ? String(row.li + 1) : ''
      const riDisplay = row.ri !== null ? String(row.ri + 1) : ''

      if (row.st === 'equal') {
        rows.push(`<tr class="${cls}"><td class="ln">${liDisplay}</td><td class="ct">${lt}</td><td class="gutter"></td><td class="ln">${riDisplay}</td><td class="ct">${rt}</td></tr>`)
      } else if (row.st === 'insert') {
        rows.push(`<tr class="${cls}"><td class="ln"></td><td class="ct"></td><td class="gutter"></td><td class="ln ins">${riDisplay}</td><td class="ct ins">${rt}</td></tr>`)
      } else if (row.st === 'delete') {
        rows.push(`<tr class="${cls}"><td class="ln del">${liDisplay}</td><td class="ct del">${lt}</td><td class="gutter"></td><td class="ln"></td><td class="ct"></td></tr>`)
      } else {
        rows.push(`<tr class="${cls}"><td class="ln del">${liDisplay}</td><td class="ct del">${lt}</td><td class="gutter"></td><td class="ln ins">${riDisplay}</td><td class="ct ins">${rt}</td></tr>`)
      }
      lineNum++
    }
  }

  const statHtml = stats ? `
  <div class="stats-bar">
    <span class="s-eq">${stats.same}</span> unchanged
    &nbsp;|&nbsp;
    <span class="s-add">+${stats.added}</span> added
    &nbsp;|&nbsp;
    <span class="s-del">-${stats.deleted}</span> deleted
    &nbsp;|&nbsp;
    <span class="s-mod">~${stats.modified}</span> modified
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace; background: ${bg}; color: ${text}; font-size: 13px; line-height: 1.6; }
.report-header { padding: 16px 24px; border-bottom: 1px solid ${border}; background: ${surface}; }
.report-title { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.report-meta { font-size: 12px; color: ${muted}; }
.stats-bar { display: flex; gap: 16px; padding: 10px 24px; background: ${surface}; border-bottom: 1px solid ${border}; font-size: 12px; }
.s-eq { color: ${muted}; font-weight: 700 } .s-add { color: ${green}; font-weight: 700 } .s-del { color: ${red}; font-weight: 700 } .s-mod { color: ${blue}; font-weight: 700 }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.ln { width: 44px; text-align: right; padding: 1px 8px; color: ${muted}; font-size: 11px; user-select: none; border-right: 1px solid ${border}; white-space: nowrap; }
.ct { padding: 1px 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
.gutter { width: 16px; background: ${surface}; border-right: 1px solid ${border}; }
.ins { color: ${green} } .del { color: ${red} }
.row-eq:hover, .row-ins:hover, .row-del:hover, .row-rep:hover { background: ${rowHover} !important }
.row-ins { background: rgba(34,197,94,.08) } .row-del { background: rgba(239,68,68,.08) } .row-rep { background: rgba(59,130,246,.06) }
.footer { padding: 12px 24px; font-size: 11px; color: ${muted}; border-top: 1px solid ${border}; text-align: center; }
@media print { body { background: #fff !important; color: #000 !important; } .row-eq, .row-ins, .row-del, .row-rep { background: #fff !important } }
</style>
</head>
<body>
<div class="report-header">
  <div class="report-title">${esc(title)}</div>
  <div class="report-meta">Left: ${esc(leftLabel)} &nbsp;|&nbsp; Right: ${esc(rightLabel)}</div>
</div>${statHtml}
<table>
<thead>
<tr><th class="ln">#</th><th>${esc(leftLabel)}</th><th class="gutter"></th><th class="ln">#</th><th>${esc(rightLabel)}</th></tr>
</thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>
<div class="footer">Generated by <a href="https://github.com/baseGame/OpenDiff" style="color:${blue}">OpenDiff</a> &nbsp;·&nbsp; ${new Date().toLocaleString()}</div>
</body>
</html>`
}

/** Trigger browser print / save-as for the HTML report */
export function printHtmlReport(html: string) {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) {
    win.onload = () => { win.print(); URL.revokeObjectURL(url) }
  }
}

/** Download the diff report as an HTML file */
export function downloadDiffReport(html: string, filename = 'diff-report.html') {
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
