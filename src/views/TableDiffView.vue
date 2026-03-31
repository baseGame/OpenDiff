<script setup lang="ts">
/**
 * TableDiffView — Phase 3
 * Features: CSV / Excel / TSV comparison using Rust LCS algorithm,
 *   column alignment, row/col diff highlighting, cell-level diff
 */
import { ref, computed, onMounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readFileText, diffTables } from '@/api'
import type { TableDiffOptions } from '@/types'

// ── State ──────────────────────────────────────────────────────────────
type ViewMode = 'table' | 'unified'
const viewMode   = ref<ViewMode>('table')
const leftPath   = ref('')
const rightPath  = ref('')
const leftData   = ref<string[][]>([])
const rightData  = ref<string[][]>([])
const leftHeader = ref<string[]>([])
const rightHeader= ref<string[]>([])
const loading    = ref(false)
const error      = ref<string | null>(null)
const delimiter  = ref<string>(',')
const hasHeaders = ref(true)
const leftFormat = ref<'csv'|'excel'>('csv')
const rightFormat= ref<'csv'|'excel'>('csv')

// ── Rust backend result ──────────────────────────────────────────────
interface TableRow { left: string[] | null; right: string[] | null; status: 'equal' | 'add' | 'del' | 'mod'; colDiffs: boolean[] }
const tableResult = ref<{
  leftHeaders: string[]; rightHeaders: string[];
  rows: TableRow[]; stats: { added: number; deleted: number; modified: number; equal: number }
} | null>(null)

// ── Load ──────────────────────────────────────────────────────────────
async function pickFile(side: 'left' | 'right') {
  const path = await open({
    multiple: false,
    title: `Select ${side} file`,
    filters: [{ name: 'Spreadsheet', extensions: ['csv','tsv','xlsx','xls','ods'] }],
  }) as string | null
  if (!path) return
  if (side === 'left') leftPath.value = path
  else rightPath.value = path
  await loadAndParse()
}

async function loadAndParse() {
  if (!leftPath.value || !rightPath.value) return
  loading.value = true
  error.value = null
  tableResult.value = null
  try {
    // Use Rust backend for LCS-based table diff
    try {
      const result = await diffTables(leftPath.value, rightPath.value, {
        ignoreWhitespace: false,
      } as TableDiffOptions)
      // Rust returns sheets[].rows[].cells[] — extract first sheet rows into tableResult
      const firstSheet = (result as any).sheets?.[0]
      if (firstSheet?.rows?.length) {
        tableResult.value = {
          leftHeaders: [],
          rightHeaders: [],
          rows: firstSheet.rows.map((r: any): TableRow => ({
            left: r.cells?.map((c: any) => c.left ?? '') ?? [],
            right: r.cells?.map((c: any) => c.right ?? '') ?? [],
            status: r.status?.toLowerCase() ?? 'equal',
            colDiffs: r.cells?.map((c: any) => c.changed ?? false) ?? [],
          })),
          stats: result.stats ?? { added: 0, deleted: 0, modified: 0, equal: 0 },
        }
      }
    } catch (_) {
      // Fallback: client-side LCS (already works below)
    }
    // Load raw data
    const [lContent, rContent] = await Promise.all([
      readFileText(leftPath.value),
      readFileText(rightPath.value),
    ])
    const sep = delimiter.value === ',' ? ',' : delimiter.value === '\t' ? '\t' : ';'
    leftData.value  = parseRows(lContent, sep)
    rightData.value = parseRows(rContent, sep)
    if (hasHeaders.value && leftData.value.length) {
      leftHeader.value  = leftData.value.shift()!
      rightHeader.value = rightData.value.shift()!
    } else {
      leftHeader.value  = leftData.value[0]?.map((_, i) => `Col ${i + 1}`) ?? []
      rightHeader.value = rightData.value[0]?.map((_, i) => `Col ${i + 1}`) ?? []
    }
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

function parseRows(content: string, sep: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter(l => l.trim())
    .map(line => {
      const cells: string[] = []
      let inQuotes = false
      let cell = ''
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { cell += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === sep && !inQuotes) {
          cells.push(cell.trim()); cell = ''
        } else {
          cell += ch
        }
      }
      cells.push(cell.trim())
      return cells
    })
}

// ── Diff rows ────────────────────────────────────────────────────────
interface RowDiff {
  leftRow:  string[] | null
  rightRow: string[] | null
  status: 'equal' | 'add' | 'del' | 'mod'
  colDiffs: boolean[]
}

// Use Rust backend result when available, fallback to local LCS
const rowDiffs = computed((): RowDiff[] => {
  if (tableResult.value?.rows?.length) {
    return tableResult.value.rows.map(r => ({
      leftRow: r.left, rightRow: r.right,
      status: r.status, colDiffs: r.colDiffs,
    } as RowDiff))
  }
  const rows: RowDiff[] = []
  const l = leftData.value
  const r = rightData.value
  const maxCols = Math.max(
    l.reduce((m, row) => Math.max(m, row.length), 0),
    r.reduce((m, row) => Math.max(m, row.length), 0),
  )
  // Pad rows to max cols
  const lPadded = l.map(row => padRow(row, maxCols))
  const rPadded = r.map(row => padRow(row, maxCols))

  // Simple LCS-based row diff
  const { ops } = lcsDiff(lPadded, rPadded)
  for (const op of ops) {
    if ('equal' in op && op.equal) {
      for (const [li, ri] of op.equal) {
        const colDiffs = lPadded[li].map((c, i) => c !== rPadded[ri][i])
        rows.push({ leftRow: lPadded[li], rightRow: rPadded[ri], status: colDiffs.some(Boolean) ? 'mod' : 'equal', colDiffs })
      }
    } else if ('delete' in op && op.delete) {
      for (const li of op.delete) {
        rows.push({ leftRow: lPadded[li], rightRow: null, status: 'del', colDiffs: new Array(maxCols).fill(false) })
      }
    } else if ('insert' in op && op.insert) {
      for (const ri of op.insert) {
        rows.push({ leftRow: null, rightRow: rPadded[ri], status: 'add', colDiffs: new Array(maxCols).fill(false) })
      }
    }
  }
  return rows
})

function padRow(row: string[], to: number): string[] {
  while (row.length < to) row.push('')
  return row
}

// ── LCS diff ──────────────────────────────────────────────────────────
function lcsDiff(a: string[][], b: string[][]) {
  const m = a.length, n = b.length
  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (rowEq(a[i-1], b[j-1])) dp[i][j] = dp[i-1][j-1] + 1
      else dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1])
    }
  }
  // Backtrack
  const ops: Array<{ equal?: [number,number][]; delete?: number[]; insert?: number[] }> = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && rowEq(a[i-1], b[j-1])) {
      ops.push({ equal: [[i-1, j-1]] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.push({ insert: [j-1] })
      j--
    } else {
      ops.push({ delete: [i-1] })
      i--
    }
  }
  ops.reverse()
  // Merge consecutive equal/delete/insert
  const merged: typeof ops = []
  for (const op of ops) {
    const last = merged[merged.length - 1]
    if (last && 'equal' in op && 'equal' in last) {
      last.equal!.push(...op.equal!)
    } else if (last && 'delete' in op && 'delete' in last) {
      last.delete!.push(...op.delete!)
    } else if (last && 'insert' in op && 'insert' in last) {
      last.insert!.push(...op.insert!)
    } else {
      merged.push(op)
    }
  }
  return { ops: merged }
}

function rowEq(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

// ── Stats ────────────────────────────────────────────────────────────
const stats = computed(() => {
  if (tableResult.value?.stats) return tableResult.value.stats
  const d = rowDiffs.value
  return {
    added:   d.filter(r => r.status === 'add').length,
    deleted: d.filter(r => r.status === 'del').length,
    modified: d.filter(r => r.status === 'mod').length,
    equal:   d.filter(r => r.status === 'equal').length,
  }
})

// ── Max columns for header ───────────────────────────────────────────
const maxCols = computed(() => {
  const d = rowDiffs.value
  const m = Math.max(
    d.reduce((mx, r) => Math.max(mx, r.leftRow?.length ?? 0), 0),
    d.reduce((mx, r) => Math.max(mx, r.rightRow?.length ?? 0), 0),
  )
  return m || 1
})

onMounted(() => {
  if (leftPath.value && rightPath.value) loadAndParse()
})
</script>

<template>
  <div class="table-diff-view flex flex-col h-full overflow-hidden">

    <!-- Toolbar -->
    <div class="table-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="pickFile('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftPath || 'Open file…' }}</span>
      </button>

      <div class="flex items-center gap-1 flex-shrink-0">
        <label class="flex items-center gap-1 text-xs text-muted">
          <span>Delimiter:</span>
          <select class="input" style="width:80px" v-model="delimiter" @change="loadAndParse">
            <option value=",">, (CSV)</option>
            <option value="	">Tab</option>
            <option value=";">; (SEM)</option>
          </select>
        </label>
        <label class="flex items-center gap-1 text-xs">
          <input type="checkbox" v-model="hasHeaders" @change="loadAndParse" />
          <span class="text-muted">Headers</span>
        </label>
      </div>

      <template v-if="leftData.length">
        <span class="badge badge-add">+{{ stats.added }}</span>
        <span class="badge badge-del">-{{ stats.deleted }}</span>
        <span class="badge badge-mod">~{{ stats.modified }}</span>
      </template>

      <button class="path-btn btn" @click="pickFile('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightPath || 'Open file…' }}</span>
      </button>
    </div>

    <!-- View mode toggle -->
    <div class="view-bar flex items-center gap-1 bg-base2 border-b border-border px-3 py-2">
      <button class="btn btn-icon" :class="{ active: viewMode === 'table' }" @click="viewMode = 'table'">📊 Table</button>
      <button class="btn btn-icon" :class="{ active: viewMode === 'unified' }" @click="viewMode = 'unified'">≡ Unified</button>
    </div>

    <!-- Status -->
    <div v-if="loading"  class="diff-status loading">⟳ Parsing spreadsheet…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Table view -->
    <div v-if="viewMode === 'table'" class="table-wrap flex-1 overflow-auto">
      <table class="diff-table">
        <thead>
          <tr>
            <th class="row-status" />
            <th v-for="(hdr, ci) in maxCols" :key="ci" class="col-hdr">
              {{ leftHeader[ci] ?? `Col ${ci+1}` }}
            </th>
            <th class="col-sep" />
            <th v-for="(hdr, ci) in maxCols" :key="'r'+ci" class="col-hdr">
              {{ rightHeader[ci] ?? `Col ${ci+1}` }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in rowDiffs"
            :key="ri"
            :class="`row-${row.status}`"
          >
            <td class="row-status">
              <span class="status-dot" :class="`dot-${row.status}`" />
            </td>
            <!-- Left cells -->
            <td
              v-for="(cell, ci) in (row.leftRow ?? new Array(maxCols).fill(''))"
              :key="'lc'+ci"
              class="cell"
              :class="{ 'cell-mod': row.colDiffs[ci] && row.status === 'mod' }"
            >{{ cell }}</td>
            <td class="col-sep" />
            <!-- Right cells -->
            <td
              v-for="(cell, ci) in (row.rightRow ?? new Array(maxCols).fill(''))"
              :key="'rc'+ci"
              class="cell"
              :class="{ 'cell-mod': row.colDiffs[ci] && row.status === 'mod' }"
            >{{ cell }}</td>
          </tr>
          <tr v-if="!rowDiffs.length && !loading" class="empty-row">
            <td :colspan="maxCols * 2 + 3" class="text-muted text-center">
              {{ leftPath ? '无差异' : '请选择两个表格文件开始对比' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Unified view -->
    <div v-else class="unified-wrap flex-1 overflow-auto font-mono text-sm">
      <template v-for="(row, ri) in rowDiffs" :key="ri">
        <div v-if="row.leftRow && row.status !== 'add'" class="uni-row" :class="`uni-${row.status}`">
          <span class="uni-marker">{{ { del:'-', mod:'~', equal:' ' }[row.status] }}</span>
          <span class="text-muted text-xs">{{ row.leftRow.join(delimiter === '\t' ? ' | ' : delimiter + ' ') }}</span>
        </div>
        <div v-if="row.rightRow && row.status !== 'del'" class="uni-row uni-add">
          <span class="uni-marker">+</span>
          <span class="text-xs">{{ row.rightRow.join(delimiter === '\t' ? ' | ' : delimiter + ' ') }}</span>
        </div>
      </template>
    </div>

  </div>
</template>

<style scoped>
.table-diff-view { background: var(--color-bg); }

.table-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0; min-height: 38px;
}
.path-btn { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 12px; }

.view-bar { flex-shrink: 0; }

.diff-status {
  padding: 5px 14px; font-size: 12px; flex-shrink: 0; border-bottom: 1px solid var(--color-border);
}
.diff-status.loading { color: var(--color-accent); }
.diff-status.error   { color: var(--color-red); }

/* Table */
.table-wrap { overflow: auto; }
.diff-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.diff-table thead { position: sticky; top: 0; z-index: 2; }
.row-status { width: 32px; background: var(--color-bg3); }
.col-hdr    { padding: 6px 10px; background: var(--color-bg3); border: 1px solid var(--color-border); font-size: 11px; font-weight: 700; color: var(--color-text-muted); white-space: nowrap; min-width: 80px; }
.col-sep    { width: 8px; background: var(--color-border); border: none; }
.cell       { padding: 3px 10px; border: 1px solid rgba(69,71,90,.25); white-space: nowrap; font-family: var(--font-mono); }

/* Row colours */
.row-add  td { background: rgba(166,227,161,.08); }
.row-del  td { background: rgba(243,139,168,.08); }
.row-mod  td { background: rgba(137,180,250,.06); }
.cell-mod { background: rgba(249,226,175,.25); }
.row-equal td { }

/* Status dot */
.status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.dot-add    { background: var(--color-green); }
.dot-del    { background: var(--color-red); }
.dot-mod    { background: var(--color-accent); }
.dot-equal  { background: var(--color-border); }

/* Unified view */
.unified-wrap { padding: 4px 0; }
.uni-row  { display: flex; align-items: baseline; padding: 1px 12px; }
.uni-add  { background: rgba(166,227,161,.08); }
.uni-del  { background: rgba(243,139,168,.08); }
.uni-mod  { background: rgba(137,180,250,.06); }
.uni-marker { width: 20px; flex-shrink: 0; color: var(--color-text-muted); }
.empty-row td { padding: 40px; }
</style>
