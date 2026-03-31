<script setup lang="ts">
/**
 * TextDiffView — Full implementation Phase 1
 * - Side-by-side diff with syntax highlighting (class-based)
 * - Character-level intra-line highlighting
 * - Sync scroll, jump to diff, minimap, ignore rules
 * - File picker, inline editing support
 * - 2-way / 3-way merge output panel
 * - HTML report export
 */
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { diffFiles, diffTexts, mergeThree } from '@/api'
import { highlightLine, detectLanguage } from '@/utils/syntaxHighlight'
import type { DiffResult, DiffOptions, MergeResult, MergeLine } from '@/types'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readFileText } from '@/api'
import DiffMinimap from '@/components/editor/DiffMinimap.vue'
import MergeOutputPanel from '@/components/editor/MergeOutputPanel.vue'
import IgnoreToolbar from '@/components/editor/IgnoreToolbar.vue'
import { ArrowUp, ArrowDown, FileOutput, Merge, FileCode2 } from 'lucide-vue-next'

const tabStore = useTabStore()
const settingsStore = useSettingsStore()
const activeTab = computed(() => tabStore.activeTab)

// ── File state ───────────────────────────────────────────────────────
const leftPath  = ref('')
const rightPath = ref('')
const basePath  = ref('')
const leftContent  = ref('')
const rightContent = ref('')

// ── Diff state ───────────────────────────────────────────────────────
const diffResult  = ref<DiffResult | null>(null)
const mergeResult = ref<MergeResult | null>(null)
const loading  = ref(false)
const error    = ref<string | null>(null)
const detectedLang = ref('plaintext')

// ── Options ──────────────────────────────────────────────────────────
const ignoreWS       = ref(false)
const ignoreCase     = ref(false)
const ignoreComments = ref(false)
const showOnlyDiffs  = ref(false)
const syncScroll     = ref(true)
const wordWrap       = ref(false)
const showMerge      = ref(false)
const algorithm      = computed(() => settingsStore.settings.diff_algorithm)

// ── Navigation ───────────────────────────────────────────────────────
const currentDiffIdx = ref(-1)
const diffLineIndices = ref<number[]>([]) // row indices with differences

// ── Scroll sync ──────────────────────────────────────────────────────
const leftPane  = ref<HTMLElement | null>(null)
const rightPane = ref<HTMLElement | null>(null)
let syncing = false

function onLeftScroll() {
  if (!syncScroll.value || syncing || !rightPane.value || !leftPane.value) return
  syncing = true
  rightPane.value.scrollTop = leftPane.value.scrollTop
  rightPane.value.scrollLeft = leftPane.value.scrollLeft
  setTimeout(() => { syncing = false }, 16)
}
function onRightScroll() {
  if (!syncScroll.value || syncing || !leftPane.value || !rightPane.value) return
  syncing = true
  leftPane.value.scrollTop = rightPane.value.scrollTop
  leftPane.value.scrollLeft = rightPane.value.scrollLeft
  setTimeout(() => { syncing = false }, 16)
}

// ── Diff computation ─────────────────────────────────────────────────
async function runDiff() {
  if (!leftContent.value && !rightContent.value) return
  loading.value = true
  error.value = null
  currentDiffIdx.value = -1
  try {
    const opts: DiffOptions = {
      algorithm: algorithm.value,
      ignoreWhitespace: ignoreWS.value,
      ignoreCase: ignoreCase.value,
      ignoreComments: ignoreComments.value,
    }
    diffResult.value = await diffTexts(leftContent.value, rightContent.value, opts)
    buildDiffIndex()
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

function buildDiffIndex() {
  diffLineIndices.value = []
  if (!diffResult.value) return
  let row = 0
  for (const op of diffResult.value.ops) {
    if ('Equal' in op) {
      row += op.Equal.count
    } else if ('Delete' in op) {
      diffLineIndices.value.push(row)
      row += op.Delete.count
    } else if ('Insert' in op) {
      diffLineIndices.value.push(row)
      row += op.Insert.count
    } else if ('Replace' in op) {
      diffLineIndices.value.push(row)
      row += op.Replace.left_count
    }
  }
}

// ── Load files ───────────────────────────────────────────────────────
async function loadFile(side: 'left' | 'right') {
  const path = await open({ multiple: false, title: `Select ${side} file` }) as string | null
  if (!path) return
  try {
    const content = await readFileText(path)
    if (side === 'left') { leftPath.value = path; leftContent.value = content }
    else { rightPath.value = path; rightContent.value = content }
    if (leftContent.value !== undefined && rightContent.value !== undefined) await runDiff()
  } catch (e: any) {
    error.value = `Cannot read file: ${e}`
  }
}

async function openBaseFile() {
  const path = await open({ multiple: false, title: 'Select BASE file (for 3-way merge)' }) as string | null
  if (!path) return
  try {
    basePath.value = path
  } catch (e: any) {
    error.value = `Cannot read base file: ${e}`
  }
}

// ── Three-way merge ──────────────────────────────────────────────────
async function runMerge() {
  if (!leftPath.value || !rightPath.value || !basePath.value) {
    error.value = 'Three-way merge requires all three paths (base, left, right)'
    return
  }
  try {
    mergeResult.value = await mergeThree(basePath.value, leftPath.value, rightPath.value)
    showMerge.value = true
  } catch (e: any) {
    error.value = String(e)
  }
}

// ── Navigation ───────────────────────────────────────────────────────
function jumpToDiff(direction: 1 | -1) {
  if (!diffLineIndices.value.length) return
  currentDiffIdx.value = Math.max(0, Math.min(
    diffLineIndices.value.length - 1,
    currentDiffIdx.value + direction,
  ))
  const lineNo = diffLineIndices.value[currentDiffIdx.value]
  const lineH = 22 // approx line height
  const scrollY = lineNo * lineH - (leftPane.value?.clientHeight ?? 400) / 2
  leftPane.value?.scrollTo({ top: Math.max(0, scrollY), behavior: 'smooth' })
}

// ── Keyboard shortcuts ───────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'F7') { e.preventDefault(); jumpToDiff(-1) }
  if (e.key === 'F8') { e.preventDefault(); jumpToDiff(1) }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (activeTab.value?.leftPath) {
    leftPath.value = activeTab.value.leftPath
    rightPath.value = activeTab.value.rightPath
    Promise.all([
      readFileText(leftPath.value).then(c => { leftContent.value = c }),
      readFileText(rightPath.value).then(c => { rightContent.value = c }),
    ]).then(() => runDiff()).catch(e => { error.value = String(e) })
  }
})
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── Display lines ────────────────────────────────────────────────────
interface DisplayRow {
  leftNo:   number | null
  rightNo:  number | null
  leftText: string
  rightText: string
  kind:     'equal' | 'add' | 'del' | 'mod' | 'fold'
  leftChars?:  [number, number][]  // [start,end] pairs for char highlights
  rightChars?: [number, number][]
}

const displayRows = computed((): DisplayRow[] => {
  if (!diffResult.value) return []
  const { ops, left_lines, right_lines, intra_line } = diffResult.value
  const rows: DisplayRow[] = []

  ops.forEach((op, opIdx) => {
    if ('Equal' in op) {
      const { left_start, right_start, count } = op.Equal
      if (showOnlyDiffs.value) return
      for (let i = 0; i < count; i++) {
        rows.push({ leftNo: left_start+i+1, rightNo: right_start+i+1,
          leftText: left_lines[left_start+i], rightText: right_lines[right_start+i], kind: 'equal' })
      }
    } else if ('Delete' in op) {
      const { left_start, count } = op.Delete
      for (let i = 0; i < count; i++) {
        rows.push({ leftNo: left_start+i+1, rightNo: null,
          leftText: left_lines[left_start+i], rightText: '', kind: 'del' })
      }
    } else if ('Insert' in op) {
      const { right_start, count } = op.Insert
      for (let i = 0; i < count; i++) {
        rows.push({ leftNo: null, rightNo: right_start+i+1,
          leftText: '', rightText: right_lines[right_start+i], kind: 'add' })
      }
    } else if ('Replace' in op) {
      const { left_start, left_count, right_start, right_count } = op.Replace
      const il = intra_line[opIdx]
      const maxLen = Math.max(left_count, right_count)
      for (let i = 0; i < maxLen; i++) {
        const hasLeft  = i < left_count
        const hasRight = i < right_count
        // Only attach char-level on 1:1 replacements
        const leftChars  = (il && left_count === 1 && right_count === 1 && hasLeft)
          ? il.leftChanges.map((r: any)  => [r.start, r.end] as [number,number]) : undefined
        const rightChars = (il && left_count === 1 && right_count === 1 && hasRight)
          ? il.rightChanges.map((r: any) => [r.start, r.end] as [number,number]) : undefined
        rows.push({
          leftNo:  hasLeft  ? left_start+i+1  : null,
          rightNo: hasRight ? right_start+i+1 : null,
          leftText:  hasLeft  ? left_lines[left_start+i]   : '',
          rightText: hasRight ? right_lines[right_start+i] : '',
          kind: 'mod',
          leftChars, rightChars,
        })
      }
    }
  })
  return rows
})

// ── Char highlight render ─────────────────────────────────────────────
function applySyntaxHighlight(text: string, lang: string): string {
  if (!text || lang === 'plaintext' || lang === 'auto') return escapeHtml(text)
  try { return highlightLine(text, lang) } catch { return escapeHtml(text) }
}

function renderWithHighlight(text: string, ranges: [number, number][] | undefined, lang?: string): string {
  const el = lang && lang !== 'auto' ? applySyntaxHighlight(text, lang) : escapeHtml(text)
  if (!ranges || !ranges.length) return el
  let out = ''
  let pos = 0
  for (const [s, e] of ranges) {
    out += escapeHtml(text.slice(pos, s))
    out += `<mark class="char-hi">${escapeHtml(text.slice(s, e))}</mark>`
    pos = e
  }
  out += escapeHtml(text.slice(pos))
  return out
}

function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// ── Report export ────────────────────────────────────────────────────
async function exportHtmlReport() {
  if (!diffResult.value) return
  const outPath = await save({ defaultPath: 'diff-report.html', filters: [{ name: 'HTML', extensions: ['html'] }] })
  if (!outPath) return
  const html = generateHtmlReport(diffResult.value, leftPath.value, rightPath.value)
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  await writeTextFile(outPath, html)
}

function generateHtmlReport(dr: DiffResult, lp: string, rp: string): string {
  const rows = displayRows.value.map(row => {
    const lc = `class="line-${row.kind} line-left">`
    const rc = `class="line-${row.kind} line-right">`
    const lno = row.leftNo ?? ''
    const rno = row.rightNo ?? ''
    const lt = escapeHtml(row.leftText)
    const rt = escapeHtml(row.rightText)
    return `<tr><td class="ln">${lno}</td><td ${lc}${lt}</td><td class="ln">${rno}</td><td ${rc}${rt}</td></tr>`
  }).join('\n')
  const s = dr.stats
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<title>OpenDiff Report</title>
<style>
body{font-family:monospace;font-size:13px;background:#1e1e2e;color:#cdd6f4;margin:0;padding:0}
h1{padding:16px 24px;background:#11111b;border-bottom:1px solid #45475a;font-size:18px;color:#89b4fa}
.stats{padding:8px 24px;background:#181825;border-bottom:1px solid #45475a;display:flex;gap:20px;font-size:12px}
table{width:100%;border-collapse:collapse}
td{padding:2px 8px;white-space:pre}
.ln{width:48px;min-width:48px;text-align:right;color:#6c7086;background:#181825;border-right:1px solid #45475a;user-select:none}
.line-add{background:rgba(166,227,161,.15)}
.line-del{background:rgba(243,139,168,.15)}
.line-mod{background:rgba(137,180,250,.10)}
</style></head><body>
<h1>⚡ OpenDiff — Diff Report</h1>
<div class="stats">
<span>LEFT: ${escapeHtml(lp)}</span>
<span>RIGHT: ${escapeHtml(rp)}</span>
<span style="color:#a6e3a1">+${s.added} added</span>
<span style="color:#f38ba8">-${s.deleted} deleted</span>
<span style="color:#89b4fa">~${s.modified} modified</span>
</div>
<table><tbody>${rows}</tbody></table>
</body></html>`
}

// ── Stats ─────────────────────────────────────────────────────────────
const stats = computed(() => diffResult.value?.stats)
const diffCountLabel = computed(() => {
  if (!diffLineIndices.value.length) return 'No differences'
  return `${currentDiffIdx.value + 1} / ${diffLineIndices.value.length} diffs`
})
</script>

<template>
  <div class="text-diff-view flex flex-col h-full overflow-hidden" tabindex="0">

    <!-- ── Top toolbar ── -->
    <div class="diff-toolbar flex items-center justify-between gap-4">
      <div class="flex-1 min-w-0">
        <button class="path-btn btn w-full" @click="loadFile('left')">
          <FileCode2 :size="14" class="text-muted" />
          <span class="text-muted text-xs font-semibold w-12 text-left">LEFT</span>
          <span class="truncate path-text">{{ leftPath || 'Select file...' }}</span>
        </button>
      </div>

      <!-- Base file selector for 3-way merge -->
      <div class="flex-shrink-0">
        <button class="base-btn btn w-full" :class="{ 'has-base': basePath }" @click="openBaseFile" title="Select base file for 3-way merge">
          <FileCode2 :size="12" :class="basePath ? 'text-accent' : 'text-muted'" />
          <span class="text-xs font-semibold w-10 text-left" :class="basePath ? 'text-accent' : 'text-muted'">BASE</span>
          <span class="truncate path-text text-xs" style="max-width:80px">{{ basePath ? basePath.split('/').pop() || basePath : '—' }}</span>
        </button>
      </div>

      <div class="toolbar-mid flex items-center justify-center gap-2">
        <select v-model="detectedLang" class="lang-select" style="font-size:12px;padding:2px 6px;height:26px;max-width:130px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:4px;color:var(--color-text);cursor:pointer" title="Syntax language">
        <option value="auto">Auto-detect</option>
        <option value="plaintext">Plain Text</option>
        <option value="javascript">JavaScript</option>
        <option value="typescript">TypeScript</option>
        <option value="python">Python</option>
        <option value="rust">Rust</option>
        <option value="java">Java</option>
        <option value="cpp">C++</option>
        <option value="go">Go</option>
        <option value="xml">HTML/XML</option>
        <option value="css">CSS</option>
        <option value="json">JSON</option>
        <option value="yaml">YAML</option>
        <option value="sql">SQL</option>
        <option value="bash">Bash</option>
        <option value="markdown">Markdown</option>
      </select>
      <div v-if="stats" class="stats-badges flex items-center gap-1.5 mr-2">
          <span class="badge badge-add" title="Added lines">+{{ stats.added }}</span>
          <span class="badge badge-del" title="Deleted lines">-{{ stats.deleted }}</span>
          <span class="badge badge-mod" title="Modified lines">~{{ stats.modified }}</span>
        </div>
        
        <div class="nav-group flex items-center bg-bg rounded border border-border p-0.5">
          <button class="btn btn-icon rounded-sm" title="Prev diff (F7)" @click="jumpToDiff(-1)">
            <ArrowUp :size="14" />
          </button>
          <span class="diff-nav-label text-xs text-muted px-2 font-mono">{{ diffCountLabel }}</span>
          <button class="btn btn-icon rounded-sm" title="Next diff (F8)" @click="jumpToDiff(1)">
            <ArrowDown :size="14" />
          </button>
        </div>

        <div class="action-group flex items-center gap-1 ml-2">
          <button class="btn btn-icon" title="Export HTML report" @click="exportHtmlReport">
            <FileOutput :size="16" />
          </button>
          <button class="btn btn-icon" :class="{ 'text-accent bg-bg2': showMerge }" title="3-way merge" @click="showMerge = !showMerge">
            <Merge :size="16" />
          </button>
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <button class="path-btn btn w-full" @click="loadFile('right')">
          <FileCode2 :size="14" class="text-muted" />
          <span class="text-muted text-xs font-semibold w-12 text-left">RIGHT</span>
          <span class="truncate path-text">{{ rightPath || 'Select file...' }}</span>
        </button>
      </div>
    </div>

    <!-- ── Options bar ── -->
    <IgnoreToolbar
      v-model:ignoreWs="ignoreWS"
      v-model:ignoreCase="ignoreCase"
      v-model:ignoreComments="ignoreComments"
      v-model:showOnlyDiffs="showOnlyDiffs"
      v-model:syncScroll="syncScroll"
      v-model:wordWrap="wordWrap"
      v-model:algorithm="settingsStore.settings.diff_algorithm"
      @change="runDiff"
    />

    <!-- ── Status bar ── -->
    <div v-if="loading" class="diff-status loading">⟳ Computing diff…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- ── Main diff area ── -->
    <div class="diff-main flex flex-1 overflow-hidden">

      <!-- Left pane -->
      <div
        ref="leftPane"
        class="diff-pane flex-1 font-mono overflow-auto"
        :class="{ 'word-wrap': wordWrap }"
        @scroll="onLeftScroll"
      >
        <table class="diff-table">
          <tbody>
            <template v-for="(row, i) in displayRows" :key="i">
              <tr :class="`diff-row row-${row.kind}`">
                <td class="line-no">{{ row.leftNo ?? '' }}</td>
                <td
                  class="line-content"
                  v-if="row.leftChars"
                  v-html="renderWithHighlight(row.leftText, row.leftChars, detectedLang)"
                />
                <td class="line-content" v-else>{{ row.leftText || '\u00a0' }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Center gutter -->
      <div class="diff-gutter flex flex-col">
        <template v-for="(row, i) in displayRows" :key="i">
          <div
            class="gutter-cell"
            :class="`gutter-${row.kind}`"
          />
        </template>
      </div>

      <!-- Right pane -->
      <div
        ref="rightPane"
        class="diff-pane flex-1 font-mono overflow-auto"
        :class="{ 'word-wrap': wordWrap }"
        @scroll="onRightScroll"
      >
        <table class="diff-table">
          <tbody>
            <template v-for="(row, i) in displayRows" :key="i">
              <tr :class="`diff-row row-${row.kind}`">
                <td class="line-no">{{ row.rightNo ?? '' }}</td>
                <td
                  class="line-content"
                  v-if="row.rightChars"
                  v-html="renderWithHighlight(row.rightText, row.rightChars, detectedLang)"
                />
                <td class="line-content" v-else>{{ row.rightText || '\u00a0' }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Minimap -->
      <DiffMinimap :diff-result="diffResult" />
    </div>

    <!-- ── Merge output panel ── -->
    <MergeOutputPanel
      v-if="showMerge"
      :merge-result="mergeResult"
      @run-merge="runMerge"
      @close="showMerge = false"
    />

  </div>
</template>

<style scoped>
.text-diff-view { background: var(--color-bg); outline: none; }

/* Toolbar */
.diff-toolbar {
  background: var(--color-bg2);
  border-bottom: 1px solid var(--color-border);
  padding: 4px 8px; flex-shrink: 0; min-height: 36px;
}
.path-btn {
  flex: 1; min-width: 0; max-width: 360px;
  gap: 6px; font-family: var(--font-mono); font-size: 12px;
  justify-content: flex-start;
}
.path-text { min-width: 0; }
.base-btn {
  flex-shrink: 0; min-width: 0;
  gap: 4px; font-family: var(--font-mono); font-size: 11px;
  justify-content: flex-start; padding: 4px 8px;
  background: var(--color-bg2); border: 1px solid var(--color-border);
  color: var(--color-text-muted); cursor: pointer; transition: all 0.15s;
  border-radius: 6px;
}
.base-btn:hover { border-color: var(--color-accent); color: var(--color-text); }
.base-btn.has-base { border-color: var(--color-accent); background: rgba(137,180,250,.08); }
.toolbar-mid {
  flex-shrink: 0; padding: 0 8px;
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
}
.diff-nav-label { white-space: nowrap; }
.btn.active { background: var(--color-accent); color: var(--color-bg); }

/* Status */
.diff-status {
  padding: 5px 16px; font-size: 12px; flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
}
.diff-status.loading { color: var(--color-accent); background: rgba(137,180,250,.08); }
.diff-status.error { color: var(--color-red); background: rgba(243,139,168,.08); }

/* Diff panes */
.diff-main { background: var(--color-bg); }
.diff-pane {
  font-size: var(--editor-font-size, 13px);
  line-height: 22px;
}
.diff-pane.word-wrap .line-content { white-space: pre-wrap; word-break: break-all; }

.diff-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
}
.line-no {
  width: 52px; min-width: 52px; text-align: right;
  padding: 0 8px 0 4px; color: var(--color-text-muted);
  font-size: 11px; user-select: none;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg2);
  position: sticky; left: 0; z-index: 1;
}
.line-content {
  padding: 0 10px;
  white-space: pre;
  overflow: hidden;
}

/* Row colours */
.row-add    td { background: var(--diff-add-bg); }
.row-del    td { background: var(--diff-del-bg); }
.row-mod    td { background: var(--diff-mod-bg); }
.row-equal  td { }
.row-add .line-no,
.row-del .line-no,
.row-mod .line-no { background: color-mix(in srgb, var(--color-bg2) 70%, transparent); }

/* Char highlight */
:deep(.char-hi) {
  background: rgba(249, 226, 175, 0.45);
  border-radius: 2px;
}
.row-del :deep(.char-hi) { background: rgba(243,139,168,.5); }
.row-add :deep(.char-hi) { background: rgba(166,227,161,.5); }

/* Gutter */
.diff-gutter {
  width: 8px; flex-shrink: 0;
  background: var(--color-bg3);
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
}
.gutter-cell { height: 22px; }
.gutter-add  { background: var(--color-green); opacity: .6; }
.gutter-del  { background: var(--color-red); opacity: .6; }
.gutter-mod  { background: var(--color-accent); opacity: .5; }
</style>
