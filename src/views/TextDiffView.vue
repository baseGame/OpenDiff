import { ref, computed, onMounted, onUnmounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { diffTexts, diffFiles, mergeThree, saveSession } from '@/api'
import { highlightLine, detectLanguage } from '@/utils/syntaxHighlight'
import { detectEncoding } from '@/utils/encoding'
import type { DiffResult, DiffOptions, DiffAlgorithm } from '@/types'
import IgnoreToolbar from '@/components/editor/IgnoreToolbar.vue'
import MergeOutputPanel from '@/components/editor/MergeOutputPanel.vue'
import SaveSessionDialog from '@/components/SaveSessionDialog.vue'
import SearchBar from '@/components/SearchBar.vue'
import GotoLineDialog from '@/components/GotoLineDialog.vue'
import ImportanceRules from '@/components/ImportanceRules.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ── State ───────────────────────────────────────────────────────
const leftPath     = ref('')
const rightPath    = ref('')
const basePath     = ref('')
const leftContent  = ref('')
const rightContent = ref('')
const diffResult   = ref<DiffResult | null>(null)
const loading      = ref(false)
const error        = ref<string | null>(null)
const fileInputLeft  = ref<HTMLInputElement | null>(null)
const fileInputRight = ref<HTMLInputElement | null>(null)
const fileInputBase  = ref<HTMLInputElement | null>(null)
const currentDiffIdx = ref(-1)
const showMerge    = ref(false)
const mergeResult = ref<any>(null)
const algorithm    = ref<DiffAlgorithm>('histogram')
const ignoreWs     = ref(false)
const ignoreCase   = ref(false)
const ignoreComments = ref(false)
const diffFilter = ref<'all'|'added'|'deleted'|'modified'>('all')
const syncScroll   = ref(true)
const wordWrap     = ref(false)
const detectedLang = ref('plaintext')
const detectedEncoding = ref({ name: 'UTF-8', confidence: 1, label: 'UTF-8' })
const selectedEncoding = ref('UTF-8')
const searchQuery   = ref('')
const searchMatchIdxs = ref<number[]>([])
const leftScrollEl  = ref<HTMLElement | null>(null)
const rightScrollEl = ref<HTMLElement | null>(null)
const isDragOver    = ref(false)
const showSaveDialog   = ref(false)
const showGotoLine     = ref(false)
const showImportanceRules = ref(false)
const bookmarkedIdxs     = ref(new Set<number>())
const showBookmarkPanel  = ref(false)
const currentBookmarkPos = ref(-1)
const searchBarRef       = ref<any>(null)
const importanceRules    = ref<any[]>([])
let dragCounter = 0

const encodingOptions = ['UTF-8', 'GBK', 'GB2312', 'BIG5', 'SHIFT-JIS', 'EUC-KR', 'ISO-8859-1', 'WINDOWS-1252', 'UTF-16LE', 'UTF-16BE', 'ASCII']

// ── File loading (Tauri desktop + browser fallback) ───────────────
async function loadFile(side: 'left' | 'right') {
  // Desktop: try Tauri dialog first
  try {
    const path = await open({ multiple: false, title: `Select ${side} file` }) as string | null
    if (!path) return
    let content = ''
    try { content = await invoke<string>('cmd_read_file_text', { path }) } catch { /* noop */ }
    if (!content) {
      const bytes: number[] = await invoke('cmd_read_file_bytes', { path })
      content = new TextDecoder(selectedEncoding.value).decode(new Uint8Array(bytes))
    }
    if (!content) return
    if (side === 'left') { leftPath.value = path; leftContent.value = content }
    else { rightPath.value = path; rightContent.value = content }
    const lang = detectLanguage(path)
    if (lang !== 'plaintext') detectedLang.value = lang
    error.value = null
    if (leftContent.value && rightContent.value) await runDiff()
    return
  } catch { /* fall through to browser */ }

  // Browser: HTML5 File API fallback
  const input = side === 'left' ? fileInputLeft.value : fileInputRight.value
  if (input) input.click()
}

function onFileSelected(side: 'left' | 'right', event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    const txt = e.target?.result as string || ''
    if (side === 'left') { leftPath.value = file.name; leftContent.value = txt }
    else { rightPath.value = file.name; rightContent.value = txt }
    const lang = detectLanguage(file.name)
    if (lang !== 'plaintext') detectedLang.value = lang
    error.value = null
    if (leftContent.value && rightContent.value) runDiff()
  }
  reader.readAsText(file)
}

function onBaseFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) basePath.value = file.name
}

async function loadBase() {
  try {
    const path = await open({ multiple: false, title: 'Select BASE file' }) as string | null
    if (path) basePath.value = path
  } catch {
    if (fileInputBase.value) fileInputBase.value.click()
  }
}

// ── Run diff ───────────────────────────────────────────────────
async function runDiff() {
  if (!leftContent.value && !rightContent.value) return
  loading.value = true; error.value = null; currentDiffIdx.value = -1
  try {
    const opts: DiffOptions = {
      algorithm: algorithm.value,
      ignoreWhitespace: ignoreWs.value,
      ignoreCase: ignoreCase.value,
      ignoreComments: ignoreComments.value,
    }
    diffResult.value = (leftPath.value && rightPath.value && !leftContent.value)
      ? await diffFiles(leftPath.value, rightPath.value, opts)
      : await diffTexts(leftContent.value, rightContent.value, opts)
    buildIndex()
    // Auto-save session
    if (leftPath.value || rightPath.value) {
      saveSession({
        id: `s_${Date.now()}`, kind: 'text_diff',
        name: leftPath.value || rightPath.value || 'Text Compare',
        left_path: leftPath.value, right_path: rightPath.value,
        config: { algorithm: algorithm.value, ignore_whitespace: ignoreWs.value, ignore_case: ignoreCase.value, ignore_comments: ignoreComments.value, extra: null },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).catch(() => {})
    }
  } catch (e: any) { error.value = String(e) }
  finally { loading.value = false }
}

function buildIndex() {
  if (!diffResult.value) return
  const idxs: number[] = []
  diffResult.value.ops.forEach((op, i) => { if (!('Equal' in op)) idxs.push(i) })
  diffIdxs.value = idxs
  currentDiffIdx.value = idxs.length > 0 ? 0 : -1
}

const diffIdxs = computed((): number[] => {
  if (!diffResult.value) return []
  const idxs: number[] = []
  diffResult.value.ops.forEach((op, i) => { if (!('Equal' in op)) idxs.push(i) })
  return idxs
})

function jumpToDiff(dir: 1 | -1) {
  const arr = diffIdxs.value; if (!arr.length) return
  const next = currentDiffIdx.value + dir
  if (next >= 0 && next < arr.length) { currentDiffIdx.value = next; scrollToIdx(arr[next]) }
}

// ── Bookmarks ─────────────────────────────────────────────────
function toggleBookmark(idx: number) {
  const s = new Set(bookmarkedIdxs.value)
  s.has(idx) ? s.delete(idx) : s.add(idx)
  bookmarkedIdxs.value = s
  syncBookmarkPos()
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
  leftScrollEl.value?.scrollTo({ top: Math.max(0, idx * 20 - 200), behavior: 'smooth' })
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
    return html.replace(new RegExp(`(${escaped})`, 'gi'), '<mark class="search-hl">$1</mark>')
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

function isRowIgnored(text: string): boolean {
  if (!importanceRules.value?.length) return false
  return importanceRules.value.filter((r: any) => r.enabled).some((r: any) => {
    try { return new RegExp(r.pattern).test(text) } catch { return false }
  })
}
const filteredRows = computed(() => {
  let result = rows.value
  // Diff type filter
  if (diffFilter.value !== 'all') {
    result = result.filter(row => {
      if (diffFilter.value === 'added')   return row.st === 'insert' || row.st === 'replace'
      if (diffFilter.value === 'deleted') return row.st === 'delete' || row.st === 'replace'
      if (diffFilter.value === 'modified') return row.st === 'replace'
      return true
    })
  }
  // Importance rules filter
  if (importanceRules.value?.length) {
    result = result.filter(row => !isRowIgnored((row.lt ?? '') + ' ' + (row.rt ?? '')))
  }
  return result
})

// ── Encoding reload ─────────────────────────────────────────────
async function reloadWithEncoding() {
  if (!leftPath.value && !rightPath.value) return
  try {
    const enc = selectedEncoding.value
    if (leftPath.value) {
      const bytes: number[] = await invoke('cmd_read_file_bytes', { path: leftPath.value })
      leftContent.value = new TextDecoder(enc, { fatal: false }).decode(new Uint8Array(bytes))
    }
    if (rightPath.value) {
      const bytes: number[] = await invoke('cmd_read_file_bytes', { path: rightPath.value })
      rightContent.value = new TextDecoder(enc, { fatal: false }).decode(new Uint8Array(bytes))
    }
    if (leftContent.value && rightContent.value) await runDiff()
  } catch { /* ignore */ }
}

// ── Search ─────────────────────────────────────────────────────
function computeSearchMatches(q: string) {
  if (!q.trim() || !diffResult.value) { searchMatchIdxs.value = []; return }
  const term = q.toLowerCase()
  const idxs: number[] = []
  rows.value.forEach((row, i) => {
    if ((row.lt + ' ' + row.rt).toLowerCase().includes(term)) idxs.push(i)
  })
  searchMatchIdxs.value = idxs
}
function onSearchQueryChange(q: string) { searchQuery.value = q; computeSearchMatches(q) }
function onSearchJump(idx: number) { scrollToIdx(idx) }

// ── Merge ─────────────────────────────────────────────────────
async function runMerge() {
  if (!leftContent.value || !rightContent.value) return
  try {
    const base = basePath.value || leftContent.value
    mergeResult.value = await mergeThree(base, leftContent.value, rightContent.value)
    showMerge.value = true
  } catch (e: any) { error.value = String(e) }
}

// ── Keyboard shortcuts ──────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); searchBarRef.value?.focus() }
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') { e.preventDefault(); showGotoLine.value = true }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'B') { showBookmarkPanel.value = !showBookmarkPanel.value }
  if ((e.ctrlKey || e.metaKey) && e.key === 'm') { e.preventDefault(); runMerge() }
  if (e.key === 'F7') { e.preventDefault(); jumpToDiff(-1) }
  if (e.key === 'F8') { e.preventDefault(); jumpToDiff(1) }
  if (e.key === 'Escape') { showBookmarkPanel.value = false; showSaveDialog.value = false; showGotoLine.value = false }
  if (e.key === ',') { router.push('/settings') }
}

// ── Drag & Drop ───────────────────────────────────────────────
function onDrop(e: DragEvent) {
  e.preventDefault(); isDragOver.value = false; dragCounter = 0
  const files = [...e.dataTransfer?.files ?? []]
  if (files.length >= 2) {
    const [a, b] = files
    if (a) { leftPath.value = a.name; const r = new FileReader(); r.onload = ev => { leftContent.value = ev.target?.result as string || ''; if (leftContent.value && rightContent.value) runDiff() }; r.readAsText(a) }
    if (b) { rightPath.value = b.name; const r = new FileReader(); r.onload = ev => { rightContent.value = ev.target?.result as string || ''; if (leftContent.value && rightContent.value) runDiff() }; r.readAsText(b) }
    return
  }
  if (files.length === 1) {
    const f = files[0]
    const slot = !leftContent.value ? 'left' : 'right'
    const r = new FileReader()
    r.onload = ev => {
      const txt = ev.target?.result as string || ''
      if (slot === 'left') { leftPath.value = f.name; leftContent.value = txt }
      else { rightPath.value = f.name; rightContent.value = txt }
      if (leftContent.value && rightContent.value) runDiff()
    }
    r.readAsText(f)
  }
}

function onGotoLine(line: number) { scrollToIdx(line - 1) }

async function handleSaveSession(name: string, _kind: any) {
  if (!leftPath.value && !rightPath.value) return
  try {
    await saveSession({
      id: `s_${Date.now()}`, kind: 'text_diff', name,
      left_path: leftPath.value, right_path: rightPath.value,
      config: { algorithm: algorithm.value, ignore_whitespace: ignoreWs.value, ignore_case: ignoreCase.value, ignore_comments: ignoreComments.value, extra: null },
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    showSaveDialog.value = false
  } catch (e: any) { error.value = String(e) }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('drop', onDrop)
  window.addEventListener('dragover', (e) => e.preventDefault())
  // Handle CLI file args from Rust backend
  window.addEventListener('opendiff:cli-files', async (e: any) => {
    const { left, right } = e.detail ?? {}
    if (left) {
      leftPath.value = left
      try { leftContent.value = await invoke('cmd_read_file_text', { path: left }) } catch { leftContent.value = '' }
    }
    if (right) {
      rightPath.value = right
      try { rightContent.value = await invoke('cmd_read_file_text', { path: right }) } catch { rightContent.value = '' }
    }
    if (leftContent.value && rightContent.value) runDiff()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('drop', onDrop)
})
</script>

<template>
  <div class="tdv" :class="{ 'tdv-drag': isDragOver }"
    @dragenter="isDragOver = true; dragCounter++"
    @dragleave="if (--dragCounter === 0) isDragOver = false"
    @drop="onDrop">

    <!-- Drop overlay -->
    <div v-if="isDragOver" class="tdv-drop">
      <div class="tdv-drop-box">
        <div class="tdv-drop-ic">📂</div>
        <div class="tdv-drop-ttl">{{ $t('text_diff.file_drop_hint') }}</div>
      </div>
    </div>

    <!-- Hidden HTML5 file inputs — browser fallback -->
    <input ref="fileInputLeft"  type="file" style="display:none" @change="onFileSelected('left',  $event)" />
    <input ref="fileInputRight" type="file" style="display:none" @change="onFileSelected('right', $event)" />
    <input ref="fileInputBase"  type="file" style="display:none" @change="onBaseFileSelected($event)" />

    <!-- Breadcrumb -->
    <div class="tdv-crumb">
      <button class="crumb-home" @click="router.push('/')">{{ $t('nav.home') }}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-cur">Text Compare</span>
      <template v-if="leftPath || rightPath">
        <span class="crumb-sep">›</span>
        <span class="crumb-file">{{ (leftPath || rightPath).split(/[/\\]/).pop() }}</span>
      </template>
    </div>

    <!-- Toolbar -->
    <div class="tdv-toolbar">
      <!-- LEFT file -->
      <button class="tdv-btn-path" @click="loadFile('left')">
        <span class="tdv-lbl">LEFT</span>
        <span class="tdv-path-txt">{{ leftPath ? leftPath.split(/[/\\]/).pop() : $t('text_diff.select_file') }}</span>
      </button>

      <!-- Run -->
      <button class="tdv-btn" :disabled="loading || (!leftContent && !rightContent)" @click="runDiff">
        ▶ {{ $t('text_diff.run') || 'Run' }}
      </button>

      <!-- RIGHT file -->
      <button class="tdv-btn-path" @click="loadFile('right')">
        <span class="tdv-lbl">RIGHT</span>
        <span class="tdv-path-txt">{{ rightPath ? rightPath.split(/[/\\]/).pop() : $t('text_diff.select_file') }}</span>
      </button>

      <!-- BASE file -->
      <button class="tdv-btn-path" :class="{ 'tdv-base-active': basePath }" @click="loadBase">
        <span class="tdv-lbl">BASE</span>
        <span class="tdv-path-txt">{{ basePath ? basePath.split(/[/\\]/).pop() : 'Base (opt)' }}</span>
      </button>

      <!-- Encoding -->
      <select v-model="selectedEncoding" class="tdv-lang" title="File encoding">
        <option v-for="enc in encodingOptions" :key="enc" :value="enc">{{ enc }}</option>
      </select>

      <!-- Ignore toolbar (whitespace, case, etc.) -->
      <IgnoreToolbar v-model:algorithm="algorithm"
        v-model:ignoreWs="ignoreWs"
        v-model:ignoreCase="ignoreCase"
        v-model:ignoreComments="ignoreComments"
        v-model:showOnlyDiffs="showOnlyDiffs"
        v-model:syncScroll="syncScroll"
        v-model:wordWrap="wordWrap"
        @change="if (leftContent || rightContent) runDiff()" />

      <div style="flex:1" />

      <!-- Diff type filter -->
      <div class="tdv-filter-group">
        <button v-for="f in [{k:'all',l:'All'},{k:'added',l:'+'},{k:'deleted',l:'−'},{k:'modified',l:'~'}]" :key="f.k"
          class="tdv-filter-btn" :class="{ active: diffFilter === f.k }"
          @click="diffFilter = f.k as any"
          :title="`Show ${f.l} only`">{{ f.l }}</button>
      </div>
      <span class="tdv-diff-count" v-if="diffIdxs.length">{{ currentDiffIdx + 1 }}/{{ diffIdxs.length }}</span>
      <button class="tdv-btn" :disabled="currentDiffIdx <= 0" @click="jumpToDiff(-1)" title="Previous diff (F7)">↑</button>
      <button class="tdv-btn" :disabled="currentDiffIdx >= diffIdxs.length - 1" @click="jumpToDiff(1)" title="Next diff (F8)">↓</button>

      <!-- Merge -->
      <button class="tdv-btn" :class="{ 'tdv-btn-on': showMerge }" :disabled="!leftContent || !rightContent" @click="runMerge" title="3-way merge (Ctrl+M)">⚡ {{ $t('text_diff.merge_panel') || 'Merge' }}</button>

      <!-- Save session -->
      <button class="tdv-btn" :disabled="!leftPath && !rightPath" @click="showSaveDialog = true" title="Save session">💾</button>

      <!-- Importance rules -->
      <button class="tdv-btn" @click="showImportanceRules = true" title="Importance rules">⚙</button>

      <!-- Bookmarks -->
      <button class="tdv-btn" :class="{ 'tdv-btn-on': showBookmarkPanel }" @click="showBookmarkPanel = !showBookmarkPanel" title="Bookmarks (Ctrl+Shift+B)">
        ★<span v-if="bookmarkedIdxs.size > 0" class="tdv-badge">{{ bookmarkedIdxs.size }}</span>
      </button>
    </div>

    <!-- Search bar -->
    <div class="tdv-toolbar" style="padding:3px 8px">
      <SearchBar ref="searchBarRef" :query="searchQuery" :match-idcs="searchMatchIdxs"
        @jump="onSearchJump" @update:query="onSearchQueryChange" />
    </div>

    <!-- Status bar -->
    <div class="tdv-status">
      <span v-if="loading" class="tdv-load">⚙ {{ $t('text_diff.computing') }}</span>
      <span v-else-if="error" class="tdv-err">⚠ {{ error }}</span>
      <template v-else-if="diffResult">
        <span class="tdv-diff-stats">
          <span class="s-add">+{{ stats.added }}</span>
          <span class="s-del">−{{ stats.deleted }}</span>
          <span class="s-mod">~{{ stats.modified }}</span>
        </span>
        <span class="tdv-lang-tag">{{ effectiveLang }}</span>
      </template>
      <span v-else class="tdv-hint">{{ $t('text_diff.no_diff') }}</span>
      <div style="flex:1" />
      <span v-if="importanceRules.length" class="tdv-rule-active">⚙ {{ importanceRules.length }} rule(s)</span>
    </div>

    <!-- Merge panel -->
    <MergeOutputPanel v-if="showMerge" :merge-result="mergeResult" class="tdv-mrg" @close="showMerge = false" @run-merge="runMerge" />

    <!-- Goto line -->
    <GotoLineDialog :visible="showGotoLine" :max-line="filteredRows.length" @goto="onGotoLine" @close="showGotoLine = false" />

    <!-- Importance rules -->
    <ImportanceRules :visible="showImportanceRules" :rules="importanceRules"
      @close="showImportanceRules = false" @update="(r) => { importanceRules = r; runDiff() }" />

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
        <div v-if="!bookmarkedIdxs.size" class="tdv-bm-empty">No bookmarks — click ☆ on a line</div>
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
    <SaveSessionDialog :visible="showSaveDialog" kind="text_diff"
      :left-path="leftPath" :right-path="rightPath"
      @close="showSaveDialog = false" @save="handleSaveSession" />

    <!-- Diff table -->
    <div class="tdv-table-wrap">
      <table class="tdiff-table">
        <colgroup>
          <col class="col-marker"><col class="col-lnum"><col class="col-content">
          <col class="col-gutter">
          <col class="col-marker"><col class="col-rnum"><col class="col-content">
        </colgroup>
        <tbody>
          <template v-for="(row, ri) in filteredRows" :key="ri">
            <tr :class="`diff-row status-${row.st}`">
              <td class="tdiff-marker">
                <span v-if="row.st === 'insert'" class="tdiff-plus">+</span>
                <span v-else-if="row.st === 'delete'" class="tdiff-minus">−</span>
                <span v-else-if="row.st === 'replace'" class="tdiff-mod">~</span>
              </td>
              <td class="tdv-num" @click="toggleBookmark(ri)" :title="isBookmarked(ri) ? 'Remove bookmark' : 'Add bookmark'">
                <span class="tdiff-star">{{ isBookmarked(ri) ? '★' : '☆' }}</span>{{ row.li !== null ? row.li + 1 : '' }}
              </td>
              <td class="tdiff-content" :class="`ct-${row.st}`" v-html="hlWithSearch(hl(row.lt, effectiveLang), searchQuery)" />
              <td class="tdv-gut" />
              <td class="tdiff-marker"><span v-if="row.st === 'insert'" class="tdiff-plus">+</span></td>
              <td class="tdv-num">{{ row.ri !== null ? row.ri + 1 : '' }}</td>
              <td class="tdiff-content" :class="`ct-${row.st}`" v-html="hlWithSearch(hl(row.rt, effectiveLang), searchQuery)" />
            </tr>
          </template>
          <tr v-if="!filteredRows.length && !loading">
            <td colspan="7" class="tdv-empty">
              <div v-if="!leftContent && !rightContent">{{ $t('text_diff.no_diff') }}</div>
              <div v-else-if="importanceRules.length">{{ $t('importance.hint') || 'All visible lines hidden by importance rules' }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.tdv { display:flex; flex-direction:column; height:100%; overflow:hidden; background:var(--color-bg); position:relative }
.tdv-drag { outline: 2px dashed var(--color-accent); outline-offset: -4px }

/* Drop overlay */
.tdv-drop { position:absolute; inset:0; z-index:50; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.65); backdrop-filter:blur(4px); pointer-events:none }
.tdv-drop-box { border:2px dashed var(--color-accent); border-radius:16px; padding:48px 64px; text-align:center }
.tdv-drop-ic { font-size:48px; margin-bottom:12px }
.tdv-drop-ttl { font-size:18px; color:#fff; font-weight:600 }

/* Breadcrumb */
.tdv-crumb { display:flex; align-items:center; gap:4px; padding:3px 16px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); font-size:11px }
.crumb-home { color:var(--color-text-muted); background:none; border:none; cursor:pointer; padding:0; font-size:11px }
.crumb-home:hover { color:var(--color-accent) }
.crumb-sep { color:var(--color-border) }
.crumb-file { color:var(--color-text); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }

/* Toolbar */
.tdv-toolbar { display:flex; align-items:center; gap:3px; padding:3px 8px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); flex-wrap:wrap; min-height:36px }
.tdv-btn-path { display:flex; align-items:center; gap:4px; padding:3px 7px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:11px; cursor:pointer; max-width:150px; overflow:hidden; transition:all .15s }
.tdv-btn-path:hover { border-color:var(--color-accent); color:var(--color-accent) }
.tdv-base-active { border-color:var(--color-yellow); color:var(--color-yellow); background:rgba(234,179,8,.08) }
.tdv-lbl { font-size:9px; font-weight:700; color:var(--color-text-muted); flex-shrink:0 }
.tdv-path-txt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px }
.tdv-btn { padding:3px 8px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all .15s; white-space:nowrap }
.tdv-btn:hover { border-color:var(--color-accent); color:var(--color-accent) }
.tdv-btn:disabled { opacity:.4; cursor:not-allowed }
.tdv-btn-on { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.tdv-lang { padding:3px 6px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:11px; cursor:pointer }
.tdv-diff-count { font-size:11px; color:var(--color-text-muted); padding:0 4px; white-space:nowrap }
.tdv-filter-group { display:flex; gap:1px }
.tdv-filter-btn { padding:2px 7px; border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text-muted); font-size:11px; cursor:pointer; font-weight:600; transition:all .1s }
.tdv-filter-btn:first-child { border-radius:4px 0 0 4px }
.tdv-filter-btn:last-child { border-radius:0 4px 4px 0 }
.tdv-filter-btn:hover { background:var(--color-bg-hover); color:var(--color-text) }
.tdv-filter-btn.active { background:var(--color-accent); border-color:var(--color-accent); color:#fff }
.tdv-badge { display:inline-flex; align-items:center; justify-content:center; background:var(--color-accent); color:#fff; border-radius:8px; font-size:10px; font-weight:700; padding:0 4px; min-width:16px; height:16px; line-height:16px }

/* Status bar */
.tdv-status { display:flex; align-items:center; gap:8px; padding:2px 16px; background:var(--color-bg3); border-bottom:1px solid var(--color-border); font-size:11px; min-height:22px }
.tdv-load { color:var(--color-accent) }
.tdv-err { color:var(--color-red) }
.tdv-hint { color:var(--color-text-muted) }
.tdv-diff-stats { display:flex; gap:8px; font-weight:600 }
.s-add { color:var(--color-green) }
.s-del { color:var(--color-red) }
.s-mod { color:var(--color-yellow) }
.tdv-lang-tag { background:var(--color-bg2); padding:1px 6px; border-radius:4px; color:var(--color-text-muted); font-size:10px }
.tdv-rule-active { color:var(--color-orange) }

/* Bookmark panel */
.tdv-bm-panel { position:absolute; top:72px; right:8px; z-index:100; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:var(--shadow-lg); width:240px; max-height:320px; display:flex; flex-direction:column }
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

/* Table */
.tdv-table-wrap { flex:1; overflow:auto }
.tdiff-table { border-collapse: collapse; width:100%; table-layout:fixed }
.col-marker { width:20px; min-width:20px }
.col-lnum { width:60px; min-width:40px }
.col-rnum { width:60px; min-width:40px }
.col-content { min-width:200px }
.col-gutter { width:16px; min-width:16px; border-left:1px solid var(--color-border); border-right:1px solid var(--color-border) }
td { padding:0 4px; vertical-align:top; font-size:12px; line-height:20px; font-family:var(--font-mono) }
.tdv-num { text-align:right; color:var(--color-text-muted); user-select:none; cursor:pointer; font-size:11px; padding-right:6px; min-width:40px }
.tdv-num:hover { color:var(--color-accent) }
.tdiff-content { padding-left:6px; padding-right:6px; white-space:pre-wrap; word-break:break-all }
.tdiff-marker { text-align:center; width:20px; min-width:20px; user-select:none; font-size:12px; padding:0 }
.tdiff-plus { color:var(--color-green); font-weight:700 }
.tdiff-minus { color:var(--color-red); font-weight:700 }
.tdiff-mod { color:var(--color-yellow); font-weight:700 }
.ct-insert { background:rgba(166,227,161,.08) }
.ct-delete { background:rgba(243,139,168,.08) }
.ct-replace { background:rgba(137,180,250,.06) }
.ct-equal { }
.diff-row:hover { background:rgba(59,130,246,.04) }
.status-add { background:rgba(166,227,161,.04) }
.status-del { background:rgba(243,139,168,.04) }
.status-mod { background:rgba(137,180,250,.04) }
.tdv-gut { background:var(--color-bg2); width:16px; min-width:16px; max-width:16px }
.tdv-empty { text-align:center; padding:48px; color:var(--color-text-muted); font-size:14px }

/* Star */
.tdiff-star { cursor:pointer; color:var(--color-text-muted); font-size:10px; margin-right:2px; user-select:none }
.tdiff-star:hover { color:#f59e0b }

/* Merge panel */
.tdv-mrg { border-top:2px solid var(--color-border); height:280px; flex-shrink:0 }

/* Dropdown style for toolbar encoding */
.tdv-enc-badge { background:var(--color-bg3); border:1px solid var(--color-border); border-radius:4px; padding:2px 6px; font-size:10px; color:var(--color-accent); cursor:pointer }

/* Search highlight */
:deep(.search-hl) { background:#f59e0b; color:#000; border-radius:2px; padding:0 1px }
