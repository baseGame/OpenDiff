<script setup lang="ts">
/**
 * TextDiffView — Complete clean implementation with i18n + search + importance rules
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { diffTexts, diffFiles, mergeThree, saveSession } from '@/api'
import { highlightLine, detectLanguage } from '@/utils/syntaxHighlight'
import { detectEncoding, SUPPORTED_ENCODINGS } from '@/utils/encoding'
import type { DiffResult, DiffOptions, CharRange, DiffAlgorithm } from '@/types'
import IgnoreToolbar from '@/components/editor/IgnoreToolbar.vue'
import MergeOutputPanel from '@/components/editor/MergeOutputPanel.vue'
import DiffMinimap from '@/components/editor/DiffMinimap.vue'
import SaveSessionDialog from '@/components/SaveSessionDialog.vue'
import SearchBar from '@/components/SearchBar.vue'
import GotoLineDialog from '@/components/GotoLineDialog.vue'
import ImportanceRules from '@/components/ImportanceRules.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ── State ───────────────────────────────────────────────────────
const leftPath     = ref('')
const rightPath    = ref('')
const basePath   = ref('')
const leftContent  = ref('')
const rightContent = ref('')
const diffResult  = ref<DiffResult | null>(null)
const loading     = ref(false)
const error       = ref<string | null>(null)
const currentDiffIdx = ref(-1)
const showMerge   = ref(false)
const mergeResult = ref<any>(null)
const algorithm   = ref<DiffAlgorithm>('histogram')
const ignoreWS   = ref(false)
const ignoreCase = ref(false)
const ignoreComments = ref(false)
const showOnlyDiffs = ref(false)
const syncScroll = ref(true)
const wordWrap = ref(false)
const detectedLang = ref('plaintext')
const detectedEncoding = ref<{ name: string; confidence: number; label: string }>({ name: 'UTF-8', confidence: 1, label: 'UTF-8' })
const selectedEncoding = ref('UTF-8')
const showEncodingPanel = ref(false)
const searchQuery = ref('')
const searchMatchIdxs = ref<number[]>([])
const leftScrollEl  = ref<HTMLElement | null>(null)
const rightScrollEl = ref<HTMLElement | null>(null)
const isDragOver = ref(false)
const showSaveDialog = ref(false)
const showGotoLine = ref(false)
const showImportanceRules = ref(false)
const bookmarkedIdxs = ref(new Set<number>())
const showBookmarkPanel = ref(false)
const currentBookmarkPos = ref(-1)
const bookmarkedIdxs = ref(new Set<number>())
const showBookmarkPanel = ref(false)
const currentBookmarkPos = ref(-1)
const bookmarkedIdxs = ref(new Set<number>())
const showBookmarkPanel = ref(false)
const currentBookmarkPos = ref(-1)
const searchBarRef = ref<any>(null)
const importanceRules = ref<any[]>([])
let dragCounter = 0

const langOptions = [
  { label: 'Auto', value: 'auto' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Rust', value: 'rust' },
  { label: 'Java', value: 'java' },
  { label: 'C++', value: 'cpp' },
  { label: 'C#', value: 'csharp' },
  { label: 'Go', value: 'go' },
  { label: 'HTML/XML', value: 'xml' },
  { label: 'CSS', value: 'css' },
  { label: 'JSON', value: 'json' },
  { label: 'YAML', value: 'yaml' },
  { label: 'SQL', value: 'sql' },
  { label: 'Bash', value: 'bash' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'Plain Text', value: 'plaintext' },
] as const

// ── File loading ────────────────────────────────────────────────
async function loadFile(side: 'left' | 'right') {
  const path = await open({ multiple: false, title: 'Select file' }) as string | null
  if (!path) return
  try {
    let content = ''
    try { content = await (async () => { const { invoke } = await import('@tauri-apps/api/core'); return invoke<string>('cmd_read_file_text', { path }) })() } catch { /* noop */ }
    if (side === 'left') { leftPath.value = path; leftContent.value = content }
    else { rightPath.value = path; rightContent.value = content }
    const lang = detectLanguage(path)
    if (lang !== 'plaintext') detectedLang.value = lang
    if (leftContent.value && rightContent.value) await runDiff()
  } catch (e: any) { error.value = String(e) }
}

// ── Load BASE file ─────────────────────────────────────────────
async function loadBase() {
  const path = await open({ multiple: false, title: 'Select BASE file' }) as string | null
  if (!path) return
  try {
    let content = ''
    try { content = await (async () => { const { invoke } = await import('@tauri-apps/api/core'); return invoke<string>('cmd_read_file_text', { path }) })() } catch { /* noop */ }
    basePath.value = path
  } catch (e: any) { error.value = String(e) }
}

// ── Run diff ───────────────────────────────────────────────────
async function runDiff() {
  if (!leftContent.value && !rightContent.value) return
  loading.value = true; error.value = null; currentDiffIdx.value = -1
  try {
    const opts: DiffOptions = {
      algorithm: algorithm.value,
      ignoreWhitespace: ignoreWS.value,
      ignoreCase: ignoreCase.value,
      ignoreComments: ignoreComments.value,
    }
    diffResult.value = (leftPath.value && rightPath.value)
      ? await diffFiles(leftPath.value, rightPath.value, opts)
      : await diffTexts(leftContent.value, rightContent.value, opts)
    buildIndex()
    if (leftPath.value || rightPath.value) {
      saveSession({ id: `s_${Date.now()}`, kind: 'text_diff', name: leftPath.value || rightPath.value || 'Text Compare',
        left_path: leftPath.value, right_path: rightPath.value,
        config: { algorithm: algorithm.value, ignore_whitespace: ignoreWS.value, ignore_case: ignoreCase.value, ignore_comments: ignoreComments.value, extra: null },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).catch(() => {})
    }
  } catch (e: any) { error.value = String(e) }
  finally { loading.value = false }
}

const diffIdxs = computed((): number[] => {
  if (!diffResult.value) return []
  return diffResult.value.ops.reduce<number[]>((acc, op, i) => { if (!('Equal' in op)) acc.push(i); return acc }, [])
})

function buildIndex() { currentDiffIdx.value = diffIdxs.value.length > 0 ? 0 : -1 }

function jumpToDiff(dir: 1 | -1) {
  const arr = diffIdxs.value; if (!arr.length) return
  const next = currentDiffIdx.value + dir
  if (next >= 0 && next < arr.length) { currentDiffIdx.value = next; scrollToIdx(arr[next]) }
}
function toggleBookmark(idx: number) {
  const s = new Set(bookmarkedIdxs.value); s.has(idx) ? s.delete(idx) : s.add(idx)
  bookmarkedIdxs.value = s; syncBookmarkPos()
}
function syncBookmarkPos() {
  const bids = [...bookmarkedIdxs.value].sort((a, b) => a - b)
  const cur = diffIdxs.value[currentDiffIdx.value]
  currentBookmarkPos.value = bids.indexOf(cur)
}
function jumpToBookmark(dir: 1 | -1) {
  const bids = [...bookmarkedIdxs.value].sort((a, b) => a - b)
  if (!bids.length) return
  currentBookmarkPos.value = Math.max(0, Math.min(bids.length - 1, currentBookmarkPos.value + dir))
  const target = bids[currentBookmarkPos.value]
  const di = diffIdxs.value.indexOf(target)
  if (di >= 0) { currentDiffIdx.value = di; scrollToIdx(target) }
}
function isBookmarked(idx: number) { return bookmarkedIdxs.value.has(idx) }
function toggleBookmark(idx: number) {
  const s = new Set(bookmarkedIdxs.value); s.has(idx) ? s.delete(idx) : s.add(idx)
  bookmarkedIdxs.value = s; syncBookmarkPos()
}
function syncBookmarkPos() {
  const bids = [...bookmarkedIdxs.value].sort((a, b) => a - b)
  const cur = diffIdxs.value[currentDiffIdx.value]
  currentBookmarkPos.value = bids.indexOf(cur)
}
function jumpToBookmark(dir: 1 | -1) {
  const bids = [...bookmarkedIdxs.value].sort((a, b) => a - b)
  if (!bids.length) return
  currentBookmarkPos.value = Math.max(0, Math.min(bids.length - 1, currentBookmarkPos.value + dir))
  const target = bids[currentBookmarkPos.value]
  const di = diffIdxs.value.indexOf(target)
  if (di >= 0) { currentDiffIdx.value = di; scrollToIdx(target) }
}
function isBookmarked(idx: number) { return bookmarkedIdxs.value.has(idx) }

function scrollToIdx(idx: number) {
  leftScrollEl.value?.scrollTo({ top: idx * 22 - 200, behavior: 'smooth' })
}

// ── Stats ─────────────────────────────────────────────────────
const stats = computed(() => diffResult.value?.stats ?? { added: 0, deleted: 0, modified: 0, equal: 0 })

// ── HTML rendering ──────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hl(text: string, lang: string): string {
  if (!text || lang === 'plaintext' || lang === 'auto') return escapeHtml(text)
  try { return highlightLine(text, lang) } catch { return escapeHtml(text) }
}

function hlWithSearch(html: string, q: string): string {
  if (!q.trim()) return html
  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(${escaped})`, 'gi')
    return html.replace(re, '<mark class="search-hl">$1</mark>')
  } catch { return html }
}

const effectiveLang = computed(() => detectedLang.value === 'auto' ? 'plaintext' : detectedLang.value)

// ── Rows ─────────────────────────────────────────────────────
interface Row { li: number|null; ri: number|null; lt: string; rt: string; st: 'equal'|'insert'|'delete'|'replace' }
const rows = computed((): Row[] => {
  if (!diffResult.value) return []
  const d = diffResult.value; const r: Row[] = []; let li = 0, ri = 0
  for (const op of d.ops) {
    if ('Equal' in op) {
      for (let i = 0; i < op.Equal.count; i++) { r.push({ li, ri, lt: d.left_lines[li]??'', rt: d.right_lines[ri]??'', st: 'equal' }); li++; ri++ }
    } else if ('Delete' in op) {
      for (let i = 0; i < op.Delete.count; i++) { r.push({ li, ri: null, lt: d.left_lines[li]??'', rt: '', st: 'delete' }); li++ }
    } else if ('Insert' in op) {
      for (let i = 0; i < op.Insert.count; i++) { r.push({ li: null, ri, lt: '', rt: d.right_lines[ri]??'', st: 'insert' }); ri++ }
    } else if ('Replace' in op) {
      const mx = Math.max(op.Replace.left_count, op.Replace.right_count)
      for (let i = 0; i < mx; i++) { r.push({ li: li+i, ri: ri+i, lt: d.left_lines[li+i]??'', rt: d.right_lines[ri+i]??'', st: 'replace' }) }
      li += op.Replace.left_count; ri += op.Replace.right_count
    }
  }
  return r
})

const encodingOptions = ['UTF-8', 'GBK', 'GB2312', 'BIG5', 'SHIFT-JIS', 'EUC-KR', 'ISO-8859-1', 'WINDOWS-1252', 'UTF-16LE', 'UTF-16BE', 'ASCII']

async function reloadWithEncoding() {
  if (!leftPath.value && !rightPath.value) return
  try {
    const enc = selectedEncoding.value
    if (leftPath.value) {
      const { invoke } = await import('@tauri-apps/api/core')
      const bytes: number[] = await invoke('cmd_read_file_bytes', { path: leftPath.value })
      leftContent.value = new TextDecoder(enc, { fatal: false }).decode(new Uint8Array(bytes))
    }
    if (rightPath.value) {
      const { invoke } = await import('@tauri-apps/api/core')
      const bytes: number[] = await invoke('cmd_read_file_bytes', { path: rightPath.value })
      rightContent.value = new TextDecoder(enc, { fatal: false }).decode(new Uint8Array(bytes))
    }
    if (leftContent.value && rightContent.value) await runDiff()
  } catch { /* ignore */ }
}

// ── Search ─────────────────────────────────────────────────────
function computeSearchMatches(q: string) {
  if (!q.trim()) { searchMatchIdxs.value = []; return }
  const lower = q.toLowerCase()
  const idxs: number[] = []
  rows.value.forEach((row, i) => {
    if (row.lt.toLowerCase().includes(lower) || row.rt.toLowerCase().includes(lower)) idxs.push(i)
  })
  searchMatchIdxs.value = idxs
}

function onSearchQueryChange(q: string) {
  searchQuery.value = q
  computeSearchMatches(q)
}

// ── Importance rules ────────────────────────────────────────────
function isRowIgnored(text: string): boolean {
  if (!importanceRules.value?.length) return false
  const lower = text.toLowerCase()
  return importanceRules.value.filter((r: any) => r.enabled).some((r: any) => {
    try { return r.isRegex ? new RegExp(r.pattern, 'i').test(lower) : lower.includes(r.pattern.toLowerCase()) } catch { return false }
  })
}

const filteredRows = computed(() => {
  const rendered = renderedRows.value
  if (!importanceRules.value?.length) return rendered
  return rendered.filter((row: any) => !isRowIgnored(row.lt + ' ' + row.rt))
})

// ── Jump to line ───────────────────────────────────────────────
function onGotoLine(line: number) {
  leftScrollEl.value?.scrollTo({ top: Math.max(0, (line - 1) * 22 - 200), behavior: 'smooth' })
}

// ── Search jump ─────────────────────────────────────────────────
function onSearchJump(idx: number) {
  leftScrollEl.value?.scrollTo({ top: Math.max(0, idx * 22 - 200), behavior: 'smooth' })
}

// ── Merge ─────────────────────────────────────────────────────
async function runMerge() {
  if (!leftContent.value && !rightContent.value) return
  loading.value = true
  try { mergeResult.value = await mergeThree(basePath.value || leftContent.value, leftContent.value, rightContent.value); showMerge.value = true }
  catch (e: any) { error.value = String(e) }
  finally { loading.value = false }
}

// ── Save session ───────────────────────────────────────────────
async function handleSaveSession(name: string, _kind: any) {
  if (!leftPath.value && !rightPath.value) return
  try {
    await saveSession({ id: `s_${Date.now()}`, name, kind: 'text_diff', left_path: leftPath.value, right_path: rightPath.value,
      config: { algorithm: algorithm.value, ignore_whitespace: ignoreWS.value, ignore_case: ignoreCase.value, ignore_comments: ignoreComments.value, extra: null },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  } catch { /* ignore */ }
}

// ── Drag & Drop ───────────────────────────────────────────────
function onDragEnter(e: DragEvent) { e.preventDefault(); dragCounter++; isDragOver.value = true }
function onDragLeave(e: DragEvent) { e.preventDefault(); dragCounter--; if (dragCounter === 0) isDragOver.value = false }
function onDragOver(e: DragEvent) { e.preventDefault() }
async function onDrop(e: DragEvent) {
  e.preventDefault(); isDragOver.value = false; dragCounter = 0
  const files = Array.from(e.dataTransfer?.files ?? []); if (!files.length) return
  try {
    const text = await files[0].text()
    if (!leftPath.value) { leftPath.value = files[0].name; leftContent.value = text }
    else { rightPath.value = files[0].name; rightContent.value = text; await runDiff() }
  } catch (e: any) { error.value = String(e) }
}

// ── Keyboard ──────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 'F7') { e.preventDefault(); jumpToDiff(-1) }
  if (e.key === 'F8') { e.preventDefault(); jumpToDiff(1) }
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); showGotoLine.value = true }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') { showBookmarkPanel.value = !showBookmarkPanel.value }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') { showBookmarkPanel.value = !showBookmarkPanel.value }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') { e.preventDefault(); showBookmarkPanel.value = !showBookmarkPanel.value }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchBarRef.value?.$el?.querySelector('input')?.focus(); searchBarRef.value?.$el?.querySelector('input')?.select() }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ── Scroll sync ────────────────────────────────────────────────
function onLeftScroll(e: Event) { rightScrollEl.value && (rightScrollEl.value.scrollTop = (e.target as HTMLElement).scrollTop) }
function onRightScroll(e: Event) { leftScrollEl.value && (leftScrollEl.value.scrollTop = (e.target as HTMLElement).scrollTop) }

// ── Minimap ──────────────────────────────────────────────────
function onMinimapClick(idx: number) { leftScrollEl.value?.scrollTo({ top: idx * 22 - 200, behavior: 'smooth' }) }

// ── Rendered rows ─────────────────────────────────────────────
const renderedRows = computed(() => rows.value.map(row => ({
  ...row,
  lHtml: hl(row.lt, effectiveLang.value),
  rHtml: hl(row.rt, effectiveLang.value),
})))
</script>

<template>
  <div class="tdv" @dragenter="onDragEnter" @dragleave="onDragLeave" @dragover="onDragOver" @drop="onDrop">

    <!-- Breadcrumb -->
    <div class="tdv-crumb">
      <button class="crumb-home" @click="router.push('/')">{{ $t('nav.home') }}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-cur">{{ $t('text_diff.title') }}</span>
      <template v-if="leftPath || rightPath">
        <span class="crumb-sep">›</span>
        <span class="crumb-file">{{ (leftPath || rightPath).split('/').pop() }}</span>
        <span class="crumb-sep" v-if="leftPath && rightPath">↔</span>
        <span class="crumb-file" v-if="rightPath">{{ rightPath.split('/').pop() }}</span>
      </template>
    </div>

    <!-- Toolbar -->
    <div class="tdv-toolbar">
      <button class="tdv-btn-path" @click="loadFile('left')">
        <span class="tdv-lbl">LEFT</span>
        <span class="tdv-path-txt">{{ leftPath ? leftPath.split('/').pop() : $t('text_diff.select_file') }}</span>
      </button>
      <button class="tdv-btn" @click="runDiff" :disabled="loading">{{ $t('text_diff.run') }}</button>
      <button class="tdv-btn-path" @click="loadFile('right')">
        <span class="tdv-lbl">RIGHT</span>
        <span class="tdv-path-txt">{{ rightPath ? rightPath.split('/').pop() : $t('text_diff.select_file') }}</span>
      </button>
      <button class="tdv-btn-path" @click="loadBase()" :class="{ 'tdv-base-active': basePath }">
        <span class="tdv-lbl">BASE</span>
        <span class="tdv-path-txt">{{ basePath ? basePath.split('/').pop() : 'BASE (optional)' }}</span>
      </button>
      <div style="flex:1" />
      <select v-model="selectedEncoding" class="tdv-lang" :title="'Encoding: ' + detectedEncoding.label" @change="reloadWithEncoding">
        <option value="UTF-8">UTF-8</option>
        <option value="GBK">GBK</option>
        <option value="GB2312">GB2312</option>
        <option value="BIG5">BIG5</option>
        <option value="SHIFT-JIS">Shift-JIS</option>
        <option value="EUC-KR">EUC-KR</option>
        <option value="ISO-8859-1">ISO-8859-1</option>
        <option value="UTF-16LE">UTF-16 LE</option>
        <option value="UTF-16BE">UTF-16 BE</option>
        <option value="ASCII">ASCII</option>
      </select>
      <span v-if="detectedEncoding.confidence < 1" class="tdv-enc-badge" :title="detectedEncoding.label" @click="showEncodingPanel = !showEncodingPanel">
        {{ detectedEncoding.name }}
      </span>
      <select v-model="detectedLang" class="tdv-lang">
        <option v-for="o in langOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <IgnoreToolbar v-model:algorithm="algorithm" v-model:ignoreWs="ignoreWS"
        v-model:ignoreCase="ignoreCase" v-model:ignoreComments="ignoreComments"
        v-model:showOnlyDiffs="showOnlyDiffs" v-model:syncScroll="syncScroll" v-model:wordWrap="wordWrap"
        @change="leftContent && rightContent ? runDiff() : undefined" />
      <div style="flex:1" />
      <button class="tdv-btn" @click="jumpToDiff(-1)" :disabled="currentDiffIdx <= 0">↑</button>
      <button class="tdv-btn" @click="jumpToDiff(1)" :disabled="currentDiffIdx >= diffIdxs.length - 1">↓</button>
      <button class="tdv-btn" :class="{ 'tdv-btn-on': showMerge }" @click="showMerge = !showMerge">{{ $t('text_diff.merge_panel') }}</button>
      <button class="tdv-btn" @click="showSaveDialog = true">{{ $t('session.save') || 'Save' }}</button>
      <button class="tdv-btn" @click="showImportanceRules = true" title="Importance Rules">⚙</button>
      <button class="tdv-btn" :class="{ 'tdv-btn-on': showBookmarkPanel }" @click="showBookmarkPanel = !showBookmarkPanel" title="Bookmarks (Ctrl+Shift+B)">★<span v-if="bookmarkedIdxs.size > 0" class="tdv-badge">{{ bookmarkedIdxs.size }}</span></button>
      <button class="tdv-btn" :class="{ 'tdv-btn-on': showBookmarkPanel }" @click="showBookmarkPanel = !showBookmarkPanel" title="Bookmarks (Ctrl+Shift+B)">★<span v-if="bookmarkedIdxs.size > 0" class="tdv-badge">{{ bookmarkedIdxs.size }}</span></button>
      <button class="tdv-btn" :class="{ 'tdv-btn-on': showBookmarkPanel }" @click="showBookmarkPanel = !showBookmarkPanel" title="Bookmarks (Ctrl+Shift+B)">
        ★ <span v-if="bookmarkedIdxs.size > 0" class="tdv-badge">{{ bookmarkedIdxs.size }}</span>
      </button>
      <div style="flex:1" />
      <SearchBar ref="searchBarRef" :query="searchQuery" :match-idcs="searchMatchIdxs" @jump="onSearchJump" @update:query="onSearchQueryChange" />
      <div style="flex:1" />
      <div class="tdv-stats" v-if="diffResult">
        <span class="s-add">+{{ stats.added }}</span>
        <span class="s-del">-{{ stats.deleted }}</span>
        <span class="s-mod">~{{ stats.modified }}</span>
      </div>
    </div>

    <!-- Status bar -->
    <div v-if="loading" class="tdv-status tdv-ldg"><div class="tdv-spin" />{{ $t('text_diff.computing') }}</div>
    <div v-else-if="error" class="tdv-status tdv-err">⚠ {{ error }} <button class="tdv-rtry" @click="runDiff">{{ $t('text_diff.retry') }}</button></div>
    <div v-else-if="!diffResult" class="tdv-status tdv-hint">📂 {{ $t('text_diff.no_diff') }}</div>

    <!-- Split diff -->
    <div class="tdv-body" v-if="diffResult">
      <div class="tdv-pane">
        <div class="tdv-phdr">{{ leftPath || 'Untitled' }}</div>
        <div class="tdv-scrl" ref="leftScrollEl" @scroll="onLeftScroll">
          <table class="tdv-tbl"><tbody>
            <tr v-for="(row, ri) in filteredRows" :key="ri" :class="`r-${row.st}`">
              <td class="tdv-num">{{ row.li !== null ? row.li + 1 : '' }}</td>
              <td class="tdv-gut" />
              <td class="tdv-cell" v-html="row.lHtml" />
            </tr>
          </tbody></table>
        </div>
      </div>
      <div class="tdv-div" />
      <div class="tdv-pane">
        <div class="tdv-phdr">{{ rightPath || 'Untitled' }}</div>
        <div class="tdv-scrl" ref="rightScrollEl" @scroll="onRightScroll">
          <table class="tdv-tbl"><tbody>
            <tr v-for="(row, ri) in filteredRows" :key="ri" :class="`r-${row.st}`">
              <td class="tdv-num"><span @click.stop="toggleBookmark(row.ri)" class="tdiff-star">{{ isBookmarked(row.ri) ? '★' : '☆' }}</span>{{ row.ri !== null ? row.ri + 1 : '' }}</td>
              <td class="tdv-gut" />
              <td class="tdv-cell" v-html="row.rHtml" />
            </tr>
          </tbody></table>
        </div>
      </div>
      <DiffMinimap :diff-result="diffResult" @scroll-to="onMinimapClick" />
    </div>

    <!-- Drag overlay -->
    <div v-if="isDragOver" class="tdv-drop">
      <div class="tdv-drop-box">
        <div class="tdv-drop-ic">📂</div>
        <div class="tdv-drop-ttl">{{ $t('text_diff.file_drop_hint') }}</div>
      </div>
    </div>

    <!-- Merge panel -->
    <MergeOutputPanel v-if="showMerge" :merge-result="mergeResult" class="tdv-mrg" @close="showMerge = false" @run-merge="runMerge" />

    <!-- Goto line -->
    <GotoLineDialog :visible="showGotoLine" :max-line="rows.length" @goto="onGotoLine" @close="showGotoLine = false" />

    <!-- Importance rules -->
    <ImportanceRules :visible="showImportanceRules" :rules="importanceRules"
      @close="showImportanceRules = false" @update="r => { importanceRules = r }" />

    <!-- Bookmark panel -->
    <div v-if="showBookmarkPanel" class="tdv-bm-panel" @click.stop>
      <div class="tdv-bm-hdr">
        <span>★ Bookmarks ({{ bookmarkedIdxs.size }})</span>
        <div class="tdv-bm-nav">
          <button class="tdv-btn" @click="jumpToBookmark(-1)" :disabled="currentBookmarkPos <= 0">←</button>
          <button class="tdv-btn" @click="jumpToBookmark(1)" :disabled="currentBookmarkPos >= bookmarkedIdxs.size - 1">→</button>
          <button class="tdv-btn" @click="showBookmarkPanel = false">✕</button>
        </div>
      </div>
      <div class="tdv-bm-list">
        <div v-if="!bookmarkedIdxs.size" class="tdv-bm-empty">No bookmarks — click ☆ on a diff line</div>
        <div v-for="(idx, bi) in [...bookmarkedIdxs].sort((a,b)=>a-b)" :key="idx"
          class="tdv-bm-item" :class="{ active: diffIdxs[currentDiffIdx] === idx }"
          @click="currentBookmarkPos = bi; const di = diffIdxs.indexOf(idx); if(di>=0){ currentDiffIdx = di; scrollToIdx(idx) }">
          <span class="tdv-bm-num">{{ bi + 1 }}</span>
          <span class="tdv-bm-lbl">Line {{ idx + 1 }}</span>
          <button class="tdv-bm-del" @click.stop="toggleBookmark(idx)">✕</button>
        </div>
      </div>
    </div>

    <!-- Save dialog -->
    <SaveSessionDialog :visible="showSaveDialog" kind="text_diff" :left-path="leftPath" :right-path="rightPath"
      @close="showSaveDialog = false" @save="handleSaveSession" />
  </div>
</template>

<style scoped>
.tdv { display:flex; flex-direction:column; height:100%; overflow:hidden; background:var(--color-bg) }
.tdv-crumb { display:flex; align-items:center; gap:4px; padding:3px 16px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); font-size:11px }
.crumb-home { color:var(--color-text-muted); background:none; border:none; cursor:pointer; padding:0; font-size:11px }
.crumb-home:hover { color:var(--color-accent) }
.crumb-sep { color:var(--color-border) }
.crumb-cur { color:var(--color-text); font-weight:600 }
.crumb-file { color:var(--color-accent); font-family:monospace; font-size:11px }
.tdv-toolbar { display:flex; align-items:center; gap:4px; padding:4px 8px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); flex-wrap:wrap; min-height:38px }
.tdv-badge { display:inline-flex; align-items:center; justify-content:center; background:var(--color-accent); color:#fff; border-radius:8px; font-size:10px; font-weight:700; padding:0 4px; min-width:16px; height:16px; line-height:16px }
.tdv-btn-on { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.tdiff-star { cursor:pointer; color:var(--color-text-muted); font-size:11px; user-select:none; flex-shrink:0; margin-left:2px }
.tdiff-star:hover { color:#f59e0b }
.tdv-bm-panel { position:absolute; top:36px; right:8px; z-index:100; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:var(--shadow-lg); width:240px; max-height:320px; display:flex; flex-direction:column }
.tdv-bm-hdr { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600 }
.tdv-bm-nav { display:flex; gap:4px }
.tdv-bm-list { overflow-y:auto; flex:1 }
.tdv-bm-empty { padding:16px; text-align:center; color:var(--color-text-muted); font-size:12px }
.tdv-bm-item { display:flex; align-items:center; gap:6px; padding:6px 10px; cursor:pointer; font-size:12px }
.tdv-bm-item:hover { background:var(--color-bg-hover) }
.tdv-bm-item.active { background:rgba(59,130,246,.1); color:var(--color-accent) }
.tdv-bm-num { color:var(--color-text-muted); font-size:10px; width:16px; flex-shrink:0 }
.tdv-bm-lbl { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.tdv-bm-del { background:none; border:none; color:var(--color-text-muted); cursor:pointer; padding:0; font-size:10px }
.tdv-bm-del:hover { color:var(--color-red) }
.tdv-badge { display:inline-flex; align-items:center; justify-content:center; background:var(--color-accent); color:#fff; border-radius:8px; font-size:10px; font-weight:700; padding:0 4px; min-width:16px; height:16px; line-height:16px }
.tdv-btn-on { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.tdiff-star { cursor:pointer; color:var(--color-text-muted); margin-right:3px; font-size:11px; user-select:none; flex-shrink:0 }
.tdiff-star:hover { color:#f59e0b }
.tdv-bm-panel { position:absolute; top:36px; right:8px; z-index:100; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:var(--shadow-lg); width:240px; max-height:320px; display:flex; flex-direction:column }
.tdv-bm-hdr { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600 }
.tdv-bm-nav { display:flex; gap:4px }
.tdv-bm-list { overflow-y:auto; flex:1 }
.tdv-bm-empty { padding:16px; text-align:center; color:var(--color-text-muted); font-size:12px }
.tdv-bm-item { display:flex; align-items:center; gap:6px; padding:6px 10px; cursor:pointer; font-size:12px }
.tdv-bm-item:hover { background:var(--color-bg-hover) }
.tdv-bm-item.active { background:rgba(59,130,246,.1); color:var(--color-accent) }
.tdv-bm-num { color:var(--color-text-muted); font-size:10px; width:16px; flex-shrink:0 }
.tdv-bm-lbl { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.tdv-bm-del { background:none; border:none; color:var(--color-text-muted); cursor:pointer; padding:0; font-size:10px }
.tdv-bm-del:hover { color:var(--color-red) }
.tdv-badge { display:inline-flex; align-items:center; justify-content:center; background:var(--color-accent); color:#fff; border-radius:8px; font-size:10px; font-weight:700; padding:0 4px; min-width:16px; height:16px; line-height:16px }
.tdv-btn-on { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.tdv-bm-panel { position:absolute; top:36px; right:8px; z-index:100; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:var(--shadow-lg); width:240px; max-height:320px; display:flex; flex-direction:column }
.tdv-bm-hdr { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--color-border); font-size:12px; font-weight:600 }
.tdv-bm-nav { display:flex; gap:4px }
.tdv-bm-list { overflow-y:auto; flex:1 }
.tdv-bm-empty { padding:16px; text-align:center; color:var(--color-text-muted); font-size:12px }
.tdv-bm-item { display:flex; align-items:center; gap:6px; padding:6px 10px; cursor:pointer; font-size:12px }
.tdv-bm-item:hover { background:var(--color-bg-hover) }
.tdv-bm-item.active { background:rgba(59,130,246,.1); color:var(--color-accent) }
.tdv-bm-num { color:var(--color-text-muted); font-size:10px; width:16px }
.tdv-bm-lbl { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.tdv-bm-del { background:none; border:none; color:var(--color-text-muted); cursor:pointer; padding:0; font-size:10px }
.tdv-bm-del:hover { color:var(--color-red) }
.tdv-btn-path { display:flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); cursor:pointer; font-size:12px; max-width:220px; overflow:hidden; color:var(--color-text) }
.tdv-btn-path:hover { border-color:var(--color-accent) }
.tdv-lbl { font-size:10px; font-weight:700; color:var(--color-text-muted); flex-shrink:0 }
.tdv-path-txt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0 }
.tdv-btn { padding:4px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all .15s }
.tdv-btn:hover { border-color:var(--color-accent); color:var(--color-accent) }
.tdv-btn:disabled { opacity:.45; cursor:not-allowed }
.tdv-btn-on { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.tdv-base-active { border-color:#22c55e; color:#22c55e }
.tdv-lang { padding:3px 6px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:11px; max-width:120px; cursor:pointer }
.tdv-enc-badge { display:inline-flex; align-items:center; padding:1px 6px; border-radius:3px; border:1px solid var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent); font-size:10px; font-weight:700; cursor:pointer }
.tdv-stats { display:flex; align-items:center; gap:6px; padding:2px 8px; background:var(--color-bg3); border-radius:12px; border:1px solid var(--color-border); font-size:11px }
.s-add { color:#22c55e; font-weight:700 }
.s-del { color:#ef4444; font-weight:700 }
.s-mod { color:#f59e0b; font-weight:700 }
.tdv-status { padding:5px 16px; font-size:12px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--color-border) }
.tdv-ldg { color:var(--color-accent); background:rgba(137,180,250,.08) }
.tdv-err { color:var(--color-red); background:rgba(243,139,168,.08) }
.tdv-hint { color:var(--color-text-muted); background:var(--color-bg2) }
.tdv-spin { width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:sp .7s linear infinite; flex-shrink:0 }
@keyframes sp { to { transform:rotate(360deg) } }
.tdv-rtry { padding:2px 10px; border:1px solid var(--color-red); border-radius:10px; background:transparent; color:var(--color-red); font-size:11px; cursor:pointer }
.tdv-rtry:hover { background:rgba(239,68,68,.1) }
.tdv-body { display:flex; flex:1; overflow:hidden }
.tdv-pane { flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden }
.tdv-phdr { padding:3px 8px; background:var(--color-bg3); border-bottom:1px solid var(--color-border); font-size:11px; color:var(--color-text-muted); flex-shrink:0 }
.tdv-scrl { flex:1; overflow:auto }
.tdv-scrl::-webkit-scrollbar { width:8px; height:8px }
.tdv-scrl::-webkit-scrollbar-thumb { background:var(--color-border); border-radius:4px }
.tdv-div { width:3px; background:var(--color-border); cursor:col-resize; flex-shrink:0 }
.tdv-tbl { width:100%; border-collapse:collapse; font-size:13px; line-height:1.6; table-layout:fixed }
.tdv-num { width:48px; padding:0 8px; color:var(--color-text-muted); font-size:11px; text-align:right; user-select:none; background:var(--color-bg3); border-right:1px solid var(--color-border); vertical-align:top; white-space:nowrap }
.tdv-gut { width:16px; background:var(--color-bg3); border-right:1px solid var(--color-border) }
.tdv-cell { padding:0 8px; white-space:pre; overflow:hidden; font-family:var(--font-mono,monospace); vertical-align:top }
:deep(.search-hl) { background:rgba(250,204,21,.4); border-radius:2px; color:inherit }
.r-equal td { background:transparent }
.r-insert td { background:rgba(166,227,161,.1) }
.r-delete td { background:rgba(243,139,168,.1) }
.r-replace td { background:rgba(137,180,250,.08) }
tr:hover td { filter:brightness(1.08) }
.tdv-drop { position:absolute; inset:0; z-index:100; background:rgba(30,30,46,.85); display:flex; align-items:center; justify-content:center; pointer-events:none; backdrop-filter:blur(4px) }
.tdv-drop-box { border:2px dashed var(--color-accent); border-radius:16px; padding:40px 60px; text-align:center; background:rgba(59,130,246,.08) }
.tdv-drop-ic { font-size:48px; margin-bottom:12px }
.tdv-drop-ttl { font-size:20px; font-weight:700; color:var(--color-accent) }
.tdv-mrg { border-top:2px solid var(--color-border); height:260px; overflow:auto; flex-shrink:0 }
</style>
