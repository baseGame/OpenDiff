<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MergeResult } from '@/types'
import { GitMerge, X, Play, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Equal, Download } from 'lucide-vue-next'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const props = defineProps<{ mergeResult: MergeResult | null }>()
const emit = defineEmits<{ (e: 'runMerge'): void; (e: 'close'): void }>()

// Conflict resolution choices: per-conflict index → 'left' | 'right' | 'both'
const choices = ref<Map<number, string>>(new Map())

function pick(idx: number, choice: 'left' | 'right' | 'both') {
  const m = new Map(choices.value)
  m.set(idx, choice)
  choices.value = m
}

function resolvedContent(line: any, idx: number): string {
  if (!('Conflict' in line)) return (line as any).Resolved ?? ''
  const c = choices.value.get(idx)
  if (c === 'left') return (line as any).Conflict.left.join('\n')
  if (c === 'right') return (line as any).Conflict.right.join('\n')
  if (c === 'both') return [...(line as any).Conflict.left, ...(line as any).Conflict.right].join('\n')
  return (line as any).Conflict.left.join('\n') // default: prefer left
}

const finalText = computed(() =>
  (props.mergeResult?.output_lines ?? []).map((l, i) => resolvedContent(l, i)).join('\n')
)

async function saveResult() {
  const out = await save({
    defaultPath: 'merged.txt',
    filters: [{ name: 'Text', extensions: ['txt', 'md', 'js', 'ts', 'py', 'rs', 'html', 'css', 'json'] }]
  } as any)
  if (!out) return
  try { await writeTextFile(out, finalText.value) } catch { /* ignore */ }
}
</script>

<template>
  <div class="merge-panel">
    <!-- Header -->
    <div class="merge-hdr">
      <div class="merge-title">
        <GitMerge :size="15" />
        <span>{{ $t('text_diff.merge_panel') || 'Merge Panel' }}</span>
      </div>
      <div class="merge-badges">
        <template v-if="mergeResult">
          <span class="badge-ok" v-if="!mergeResult.conflict_count">
            <CheckCircle2 :size="12" /> {{ $t('merge.no_conflicts') || 'No conflicts' }}
          </span>
          <span class="badge-warn" v-else>
            <AlertCircle :size="12" /> {{ mergeResult.conflict_count }} {{ $t('merge.conflicts') || 'conflicts' }}
          </span>
        </template>
      </div>
      <div class="merge-hdr-actions">
        <button class="mbtn mbtn-primary" @click="emit('runMerge')">
          <Play :size="13" />
          <span>{{ $t('text_diff.run_merge') || 'Execute Merge' }}</span>
        </button>
        <button class="mbtn mbtn-icon" title="Save merged result" @click="saveResult">
          <Download :size="14" />
        </button>
        <button class="mbtn mbtn-icon mbtn-close" title="Close" @click="emit('close')">
          <X :size="15" />
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="merge-body">
      <template v-if="mergeResult">
        <div v-for="(line, idx) in mergeResult.output_lines" :key="idx">
          <!-- Resolved line -->
          <div v-if="!('Conflict' in line)" class="merge-resolved">{{ (line as any).Resolved || ' ' }}</div>
          <!-- Conflict block -->
          <div v-else class="conflict-block" :class="`choice-${choices.get(idx) || 'none'}`">
            <!-- Resolution toolbar -->
            <div class="conflict-toolbar">
              <span class="conflict-label">⚠ Conflict</span>
              <button class="mbtn mbtn-r left" :class="{ active: choices.get(idx) === 'left' }" @click="pick(idx, 'left')">
                <ChevronLeft :size="11" /> Left
              </button>
              <button class="mbtn mbtn-r base" :class="{ active: choices.get(idx) === 'both' }" @click="pick(idx, 'both')">
                Both
              </button>
              <button class="mbtn mbtn-r right" :class="{ active: choices.get(idx) === 'right' }" @click="pick(idx, 'right')">
                Right <ChevronRight :size="11" />
              </button>
            </div>
            <!-- LEFT -->
            <div class="conflict-section left-sec">
              <div class="sec-hdr left-hdr"><ChevronLeft :size="11" /> LEFT</div>
              <div class="sec-line" v-for="(l, j) in (line as any).Conflict.left" :key="`l${j}`">{{ l || ' ' }}</div>
            </div>
            <!-- BASE -->
            <div class="conflict-section base-sec">
              <div class="sec-hdr base-hdr"><Equal :size="11" /> BASE</div>
              <div class="sec-line" v-for="(l, j) in (line as any).Conflict.base" :key="`b${j}`">{{ l || ' ' }}</div>
            </div>
            <!-- RIGHT -->
            <div class="conflict-section right-sec">
              <div class="sec-hdr right-hdr">RIGHT <ChevronRight :size="11" /></div>
              <div class="sec-line" v-for="(l, j) in (line as any).Conflict.right" :key="`r${j}`">{{ l || ' ' }}</div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="merge-empty">
        <GitMerge :size="30" />
        <p>{{ $t('merge.hint') || 'Select BASE + Left + Right files, then click Execute Merge' }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.merge-panel { display:flex; flex-direction:column; height:260px; border-top:2px solid var(--color-border, #3f3f46); background:var(--color-bg, #18181b); flex-shrink:0 }
.merge-hdr { display:flex; align-items:center; gap:10px; padding:6px 14px; border-bottom:1px solid var(--color-border, #3f3f46); background:var(--color-bg2, #1e1e2e); flex-shrink:0 }
.merge-title { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--color-accent, #3b82f6); flex-shrink:0 }
.merge-badges { flex:1 }
.badge-ok { display:flex; align-items:center; gap:5px; font-size:11px; color:#22c55e; padding:2px 8px; background:rgba(34,197,94,.1); border:1px solid rgba(34,197,94,.2); border-radius:10px }
.badge-warn { display:flex; align-items:center; gap:5px; font-size:11px; color:#f59e0b; padding:2px 8px; background:rgba(245,158,11,.1); border:1px solid rgba(245,158,11,.2); border-radius:10px }
.merge-hdr-actions { display:flex; align-items:center; gap:4px }
.mbtn { display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px; border:1px solid var(--color-border, #3f3f46); background:var(--color-surface, #27272a); color:var(--color-text, #f4f4f5); font-size:11px; cursor:pointer; transition:all .15s }
.mbtn:hover { border-color:var(--color-accent, #3b82f6); color:var(--color-accent, #3b82f6) }
.mbtn-primary { background:var(--color-accent, #3b82f6); border-color:var(--color-accent, #3b82f6); color:white; font-weight:600 }
.mbtn-primary:hover { background:#2563eb; color:white }
.mbtn-icon { padding:4px 6px }
.mbtn-close:hover { border-color:#ef4444; color:#ef4444 }
.mbtn-r { padding:2px 8px; font-size:11px }
.mbtn-r.left { color:#ef4444 }
.mbtn-r.left.active { background:rgba(239,68,68,.15); border-color:#ef4444 }
.mbtn-r.base { color:#3b82f6 }
.mbtn-r.base.active { background:rgba(59,130,246,.15); border-color:#3b82f6 }
.mbtn-r.right { color:#22c55e }
.mbtn-r.right.active { background:rgba(34,197,94,.15); border-color:#22c55e }

.merge-body { flex:1; overflow:auto; font-family:var(--font-mono, monospace); font-size:13px; line-height:1.6 }
.merge-resolved { padding:1px 14px; white-space:pre }
.merge-resolved:hover { background:var(--color-surface, #27272a) }
.merge-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--color-text-muted, #a1a1aa); gap:12px }
.merge-empty p { font-family:var(--font-ui, sans-serif); font-size:13px }

.conflict-block { border:1px solid var(--color-border, #3f3f46); margin:6px 14px; border-radius:8px; overflow:hidden }
.conflict-block.choice-left { border-color:#ef4444 }
.conflict-block.choice-right { border-color:#22c55e }
.conflict-block.choice-both { border-color:#3b82f6 }

.conflict-toolbar { display:flex; align-items:center; gap:4px; padding:5px 10px; background:var(--color-bg2, #1e1e2e); border-bottom:1px solid var(--color-border, #3f3f46) }
.conflict-label { font-size:11px; color:#f59e0b; font-weight:600; margin-right:4px }

.conflict-section { }
.sec-hdr { display:flex; align-items:center; gap:4px; padding:3px 10px; font-size:10px; font-weight:700; letter-spacing:.5px }
.left-hdr { background:rgba(239,68,68,.15); color:#ef4444; border-bottom:1px solid rgba(239,68,68,.2) }
.base-hdr { background:rgba(137,180,250,.1); color:#71717a; border-bottom:1px solid rgba(137,180,250,.2); border-top:1px solid rgba(137,180,250,.2) }
.right-hdr { background:rgba(34,197,94,.15); color:#22c55e; border-top:1px solid rgba(34,197,94,.2) }
.sec-line { padding:2px 10px; font-size:12px; white-space:pre; color:var(--color-text, #f4f4f5) }
</style>
