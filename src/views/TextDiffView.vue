<script setup lang="ts">
/**
 * TextDiffView — Core text comparison view
 * Features: side-by-side diff, char-level highlighting, sync scroll,
 *           ignore rules toolbar, minimap, 2-way / 3-way merge output
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { useSettingsStore } from '@/stores/settings'
import { diffTexts, diffFiles } from '@/api'
import type { DiffResult, DiffOp, DiffOptions } from '@/types'
import { open } from '@tauri-apps/plugin-dialog'
import DiffMinimap from '@/components/editor/DiffMinimap.vue'

const tabStore = useTabStore()
const settingsStore = useSettingsStore()

const activeTab = computed(() => tabStore.activeTab)

// ── State ───────────────────────────────────────────────────────────
const leftContent  = ref('')
const rightContent = ref('')
const diffResult   = ref<DiffResult | null>(null)
const loading      = ref(false)
const error        = ref<string | null>(null)

// Ignore options
const ignoreWS   = ref(false)
const ignoreCase = ref(false)
const ignoreComments = ref(false)
const algorithm  = computed(() => settingsStore.settings.diff_algorithm)

// View options
const showOnlyDiffs = ref(false)
const syncScroll    = ref(true)
const wordWrap      = ref(false)

// Scroll sync
const leftPane  = ref<HTMLElement | null>(null)
const rightPane = ref<HTMLElement | null>(null)
let syncing = false

// ── Load & Diff ─────────────────────────────────────────────────────
async function runDiff() {
  if (!leftContent.value && !rightContent.value && !activeTab.value?.leftPath) return
  loading.value = true
  error.value = null
  try {
    const opts: DiffOptions = {
      algorithm: algorithm.value,
      ignoreWhitespace: ignoreWS.value,
      ignoreCase: ignoreCase.value,
      ignoreComments: ignoreComments.value,
    }
    if (activeTab.value?.leftPath && activeTab.value?.rightPath) {
      diffResult.value = await diffFiles(activeTab.value.leftPath, activeTab.value.rightPath, opts)
      leftContent.value = diffResult.value.left_lines.join('\n')
      rightContent.value = diffResult.value.right_lines.join('\n')
    } else {
      diffResult.value = await diffTexts(leftContent.value, rightContent.value, opts)
    }
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (activeTab.value?.leftPath) runDiff()
})

watch(() => activeTab.value?.leftPath, () => {
  if (activeTab.value?.leftPath) runDiff()
})

// ── File picker ─────────────────────────────────────────────────────
async function pickFile(side: 'left' | 'right') {
  const path = await open({ multiple: false, title: `Select ${side} file` })
  if (!path) return
  if (side === 'left' && activeTab.value) {
    (activeTab.value as any).leftPath = path as string
  } else if (activeTab.value) {
    (activeTab.value as any).rightPath = path as string
  }
  await runDiff()
}

// ── Sync scroll ─────────────────────────────────────────────────────
function onLeftScroll() {
  if (!syncScroll.value || syncing) return
  syncing = true
  rightPane.value!.scrollTop = leftPane.value!.scrollTop
  setTimeout(() => syncing = false, 10)
}
function onRightScroll() {
  if (!syncScroll.value || syncing) return
  syncing = true
  leftPane.value!.scrollTop = rightPane.value!.scrollTop
  setTimeout(() => syncing = false, 10)
}

// ── Render helpers ──────────────────────────────────────────────────
const CONTEXT_LINES = 3

interface DisplayLine {
  lineNo: number | null
  content: string
  kind: 'equal' | 'add' | 'del' | 'mod' | 'empty' | 'fold'
}

function buildDisplayLines(): { left: DisplayLine[]; right: DisplayLine[] } {
  const left: DisplayLine[] = []
  const right: DisplayLine[] = []
  if (!diffResult.value) return { left, right }
  const { ops, left_lines, right_lines } = diffResult.value

  for (const op of ops) {
    if ('Equal' in op) {
      const { left_start, right_start, count } = op.Equal
      for (let i = 0; i < count; i++) {
        if (!showOnlyDiffs.value) {
          left.push({ lineNo: left_start + i + 1, content: left_lines[left_start + i], kind: 'equal' })
          right.push({ lineNo: right_start + i + 1, content: right_lines[right_start + i], kind: 'equal' })
        }
      }
    } else if ('Delete' in op) {
      const { left_start, count } = op.Delete
      for (let i = 0; i < count; i++) {
        left.push({ lineNo: left_start + i + 1, content: left_lines[left_start + i], kind: 'del' })
        right.push({ lineNo: null, content: '', kind: 'empty' })
      }
    } else if ('Insert' in op) {
      const { right_start, count } = op.Insert
      for (let i = 0; i < count; i++) {
        left.push({ lineNo: null, content: '', kind: 'empty' })
        right.push({ lineNo: right_start + i + 1, content: right_lines[right_start + i], kind: 'add' })
      }
    } else if ('Replace' in op) {
      const { left_start, left_count, right_start, right_count } = op.Replace
      const maxLen = Math.max(left_count, right_count)
      for (let i = 0; i < maxLen; i++) {
        const lLine = i < left_count ? left_lines[left_start + i] : null
        const rLine = i < right_count ? right_lines[right_start + i] : null
        left.push(lLine !== null
          ? { lineNo: left_start + i + 1, content: lLine, kind: 'mod' }
          : { lineNo: null, content: '', kind: 'empty' }
        )
        right.push(rLine !== null
          ? { lineNo: right_start + i + 1, content: rLine, kind: 'mod' }
          : { lineNo: null, content: '', kind: 'empty' }
        )
      }
    }
  }

  return { left, right }
}

const displayLines = computed(() => buildDisplayLines())

function lineClass(kind: string) {
  return {
    'line-equal': kind === 'equal',
    'line-add':   kind === 'add',
    'line-del':   kind === 'del',
    'line-mod':   kind === 'mod',
    'line-empty': kind === 'empty',
  }
}

const stats = computed(() => diffResult.value?.stats)
</script>

<template>
  <div class="text-diff-view flex flex-col h-full overflow-hidden">
    <!-- Toolbar -->
    <div class="diff-toolbar flex items-center gap-2">
      <!-- Left path -->
      <button class="path-btn btn" @click="pickFile('left')">
        <span class="text-muted text-xs">LEFT:</span>
        <span class="truncate" style="max-width:200px">{{ activeTab?.leftPath || 'Click to open…' }}</span>
      </button>
      <div class="flex-1" />

      <!-- Stats -->
      <template v-if="stats">
        <span class="badge badge-add">+{{ stats.added }}</span>
        <span class="badge badge-del">-{{ stats.deleted }}</span>
        <span class="badge badge-mod">~{{ stats.modified }}</span>
      </template>

      <div class="flex-1" />

      <!-- Right path -->
      <button class="path-btn btn" @click="pickFile('right')">
        <span class="text-muted text-xs">RIGHT:</span>
        <span class="truncate" style="max-width:200px">{{ activeTab?.rightPath || 'Click to open…' }}</span>
      </button>
    </div>

    <!-- Options bar -->
    <div class="options-bar flex items-center gap-3">
      <label class="opt-check"><input type="checkbox" v-model="ignoreWS" @change="runDiff"> Ignore Whitespace</label>
      <label class="opt-check"><input type="checkbox" v-model="ignoreCase" @change="runDiff"> Ignore Case</label>
      <label class="opt-check"><input type="checkbox" v-model="ignoreComments" @change="runDiff"> Ignore Comments</label>
      <div class="divider divider-v" style="height:14px" />
      <label class="opt-check"><input type="checkbox" v-model="showOnlyDiffs"> Only Diffs</label>
      <label class="opt-check"><input type="checkbox" v-model="syncScroll"> Sync Scroll</label>
      <div class="flex-1" />
      <select class="input" style="width:130px" v-model="settingsStore.settings.diff_algorithm" @change="runDiff">
        <option value="histogram">Histogram</option>
        <option value="myers">Myers</option>
        <option value="patience">Patience</option>
      </select>
      <button class="btn btn-primary" @click="runDiff">⟳ Re-compare</button>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading" class="diff-status text-muted">Computing diff…</div>
    <div v-else-if="error" class="diff-status text-red">Error: {{ error }}</div>

    <!-- Main diff area -->
    <div class="diff-main flex flex-1 overflow-hidden">
      <!-- Left pane -->
      <div ref="leftPane" class="diff-pane flex-1 overflow-auto font-mono" @scroll="onLeftScroll">
        <table class="diff-table">
          <tbody>
            <tr v-for="(line, i) in displayLines.left" :key="i" :class="lineClass(line.kind)">
              <td class="line-no">{{ line.lineNo ?? '' }}</td>
              <td class="line-content">{{ line.kind !== 'empty' ? line.content : '\u00a0' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Gutter (copy buttons placeholder) -->
      <div class="diff-gutter" />

      <!-- Right pane -->
      <div ref="rightPane" class="diff-pane flex-1 overflow-auto font-mono" @scroll="onRightScroll">
        <table class="diff-table">
          <tbody>
            <tr v-for="(line, i) in displayLines.right" :key="i" :class="lineClass(line.kind)">
              <td class="line-no">{{ line.lineNo ?? '' }}</td>
              <td class="line-content">{{ line.kind !== 'empty' ? line.content : '\u00a0' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Minimap -->
      <DiffMinimap :diff-result="diffResult" />
    </div>
  </div>
</template>

<style scoped>
.text-diff-view { background: var(--color-bg); }

.diff-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0; gap: 6px;
}
.path-btn { max-width: 280px; font-family: var(--font-mono); font-size: 12px; }

.options-bar {
  background: var(--color-bg3); border-bottom: 1px solid var(--color-border);
  padding: 4px 10px; flex-shrink: 0; font-size: 12px;
}
.opt-check { display: flex; align-items: center; gap: 5px; cursor: pointer; color: var(--color-text-muted); }
.opt-check input { accent-color: var(--color-accent); }

.diff-status {
  padding: 8px 16px; font-size: 13px; border-bottom: 1px solid var(--color-border);
}

.diff-main { background: var(--color-bg); }

.diff-pane {
  font-size: var(--editor-font-size, 13px);
  line-height: 1.55;
  background: var(--color-bg);
}

.diff-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
}

.line-no {
  width: 48px; min-width: 48px; text-align: right; padding: 0 8px 0 4px;
  color: var(--color-text-muted); font-size: 11px; user-select: none;
  border-right: 1px solid var(--color-border); background: var(--color-bg2);
  position: sticky; left: 0;
}
.line-content {
  padding: 0 8px; white-space: pre; overflow: hidden; word-break: break-all;
}

/* Line colours */
.line-add td  { background: var(--diff-add-bg); }
.line-del td  { background: var(--diff-del-bg); }
.line-mod td  { background: var(--diff-mod-bg); }
.line-empty td { background: repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,.02) 4px, rgba(255,255,255,.02) 8px); }

.diff-gutter {
  width: 24px; flex-shrink: 0; background: var(--color-bg3);
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
}
</style>
