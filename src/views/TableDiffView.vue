<script setup lang="ts">
/**
 * TableDiffView — Phase 3
 * Compare CSV/TSV files as structured tables
 */
import { ref, computed, onMounted } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { readFileText } from '@/api'
import { open } from '@tauri-apps/plugin-dialog'

const tabStore  = useTabStore()
const activeTab = computed(() => tabStore.activeTab)

const leftPath  = ref('')
const rightPath = ref('')
const leftRows  = ref<string[][]>([])
const rightRows = ref<string[][]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)

// Options
const hasHeader    = ref(true)
const keyCol       = ref(0)
const delimiter    = ref(',')
const numTolerance = ref(0)

// Load and parse CSV
async function loadFile(side: 'left' | 'right') {
  const path = await open({ multiple: false, title: `Select ${side} CSV file` }) as string | null
  if (!path) return
  try {
    const content = await readFileText(path)
    const rows = parseCsv(content, delimiter.value)
    if (side === 'left') { leftPath.value = path; leftRows.value = rows }
    else { rightPath.value = path; rightRows.value = rows }
  } catch (e: any) {
    error.value = String(e)
  }
}

function parseCsv(text: string, sep: string): string[][] {
  return text.split('\n')
    .filter(l => l.trim())
    .map(line => line.split(sep).map(c => c.trim().replace(/^"|"$/g, '')))
}

// Column headers
const headers = computed(() => {
  const src = leftRows.value.length ? leftRows.value : rightRows.value
  if (!src.length) return []
  return hasHeader.value ? src[0] : src[0].map((_, i) => `Col ${i + 1}`)
})

const leftData  = computed(() => hasHeader.value ? leftRows.value.slice(1)  : leftRows.value)
const rightData = computed(() => hasHeader.value ? rightRows.value.slice(1) : rightRows.value)

// Build key-based aligned rows
const alignedRows = computed(() => {
  const leftMap  = new Map<string, string[]>()
  const rightMap = new Map<string, string[]>()
  leftData.value.forEach(r  => leftMap.set(r[keyCol.value] ?? '', r))
  rightData.value.forEach(r => rightMap.set(r[keyCol.value] ?? '', r))
  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()])
  return Array.from(allKeys).map(k => ({
    key:   k,
    left:  leftMap.get(k),
    right: rightMap.get(k),
    status: !leftMap.has(k) ? 'right-only' : !rightMap.has(k) ? 'left-only' : rowStatus(leftMap.get(k)!, rightMap.get(k)!),
  }))
})

function rowStatus(l: string[], r: string[]): 'same' | 'modified' {
  const max = Math.max(l.length, r.length)
  for (let i = 0; i < max; i++) {
    const lv = l[i] ?? ''
    const rv = r[i] ?? ''
    if (numTolerance.value > 0) {
      const ln = parseFloat(lv)
      const rn = parseFloat(rv)
      if (!isNaN(ln) && !isNaN(rn) && Math.abs(ln - rn) <= numTolerance.value) continue
    }
    if (lv !== rv) return 'modified'
  }
  return 'same'
}

function cellStatus(l?: string, r?: string): string {
  if (l === undefined || r === undefined) return ''
  if (l === r) return ''
  if (numTolerance.value > 0) {
    const ln = parseFloat(l), rn = parseFloat(r)
    if (!isNaN(ln) && !isNaN(rn) && Math.abs(ln - rn) <= numTolerance.value) return ''
  }
  return 'cell-diff'
}

const stats = computed(() => ({
  total: alignedRows.value.length,
  modified: alignedRows.value.filter(r => r.status === 'modified').length,
  leftOnly: alignedRows.value.filter(r => r.status === 'left-only').length,
  rightOnly: alignedRows.value.filter(r => r.status === 'right-only').length,
}))

onMounted(() => {
  if (activeTab.value?.leftPath) { leftPath.value = activeTab.value.leftPath; leftRows.value = [] }
  if (activeTab.value?.rightPath) { rightPath.value = activeTab.value.rightPath; rightRows.value = [] }
})
</script>

<template>
  <div class="table-diff-view flex flex-col h-full overflow-hidden">

    <!-- Toolbar -->
    <div class="table-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="loadFile('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftPath || 'Open CSV…' }}</span>
      </button>
      <div class="flex items-center gap-2 flex-shrink-0">
        <label class="opt-check"><input type="checkbox" v-model="hasHeader" /> Header row</label>
        <label class="text-xs text-muted">Key col:</label>
        <input type="number" v-model="keyCol" min="0" class="input" style="width:52px" />
        <label class="text-xs text-muted">Delim:</label>
        <select class="input" style="width:60px" v-model="delimiter">
          <option value=",">,</option>
          <option value="&#9;">Tab</option>
          <option value=";">;</option>
        </select>
        <label class="text-xs text-muted">Tolerance:</label>
        <input type="number" v-model="numTolerance" step="0.01" class="input" style="width:72px" />
      </div>
      <button class="path-btn btn" @click="loadFile('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightPath || 'Open CSV…' }}</span>
      </button>
    </div>

    <!-- Stats -->
    <div v-if="alignedRows.length" class="stats-bar flex items-center gap-3">
      <span class="text-xs text-muted">{{ stats.total }} rows</span>
      <span class="badge badge-mod">~{{ stats.modified }} modified</span>
      <span class="badge badge-del">◀{{ stats.leftOnly }} left-only</span>
      <span class="badge badge-add">▶{{ stats.rightOnly }} right-only</span>
    </div>

    <div v-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Table -->
    <div class="table-main flex-1 overflow-auto">
      <table class="cmp-table" v-if="alignedRows.length">
        <thead>
          <tr>
            <th class="col-status"></th>
            <th v-for="h in headers" :key="h" class="col-left">{{ h }}</th>
            <th v-for="h in headers" :key="h+'r'" class="col-right">{{ h }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in alignedRows" :key="i" :class="`row-${row.status}`">
            <td class="col-status">
              <span :class="['status-badge', row.status === 'same' ? '' : row.status === 'modified' ? 'badge-mod' : row.status === 'left-only' ? 'badge-del' : 'badge-add']">
                {{ row.status === 'same' ? '=' : row.status === 'modified' ? '~' : row.status === 'left-only' ? '◀' : '▶' }}
              </span>
            </td>
            <td v-for="(h, ci) in headers" :key="ci" :class="['col-left', cellStatus(row.left?.[ci], row.right?.[ci])]">
              {{ row.left?.[ci] ?? '' }}
            </td>
            <td v-for="(h, ci) in headers" :key="ci+'r'" :class="['col-right', cellStatus(row.left?.[ci], row.right?.[ci])]">
              {{ row.right?.[ci] ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state text-muted">
        <div style="font-size:48px;margin-bottom:12px">📊</div>
        <p>打开两个 CSV / TSV 文件开始表格对比</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-diff-view { background: var(--color-bg); }
.table-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0;
}
.path-btn { flex: 1; min-width: 0; font-size: 12px; }
.stats-bar { background: var(--color-bg3); border-bottom: 1px solid var(--color-border); padding: 4px 12px; flex-shrink: 0; }
.diff-status { padding: 5px 14px; font-size: 12px; color: var(--color-red); }
.opt-check { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-muted); cursor: pointer; }
.opt-check input { accent-color: var(--color-accent); }
.table-main { overflow: auto; }
.cmp-table { width: 100%; border-collapse: collapse; font-size: 12px; font-family: var(--font-mono); }
.cmp-table thead tr { background: var(--color-bg3); border-bottom: 2px solid var(--color-border); position: sticky; top: 0; z-index: 2; }
.cmp-table th { padding: 6px 8px; text-align: left; font-size: 11px; color: var(--color-text-muted); white-space: nowrap; }
.cmp-table td { padding: 4px 8px; border-bottom: 1px solid rgba(69,71,90,.25); white-space: nowrap; }
.col-status { width: 40px; text-align: center; }
.col-left, .col-right { min-width: 100px; }
.row-modified td { background: rgba(137,180,250,.06); }
.row-left-only td { background: rgba(243,139,168,.06); }
.row-right-only td { background: rgba(166,227,161,.06); }
.cell-diff { background: rgba(249,226,175,.3) !important; color: var(--color-yellow); font-weight: 600; }
.status-badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 700; }
.badge-mod { background: rgba(137,180,250,.2); color: var(--color-accent); }
.badge-add { background: rgba(166,227,161,.2); color: var(--color-green); }
.badge-del { background: rgba(243,139,168,.2); color: var(--color-red); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
</style>
