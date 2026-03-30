<script setup lang="ts">
/**
 * DiffMinimap — Phase 1 Fix
 * - Full scroll-to-click navigation
 * - Fixed division-by-zero crash
 * - Shows scroll position indicator
 * - Color density bar for diff regions
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { DiffResult } from '@/types'

const props = defineProps<{ diffResult: DiffResult | null }>()

// ── Segment data ─────────────────────────────────────────────────────
interface Seg { kind: 'add'|'del'|'mod'|'eq'; heightPx: number }
const totalLines = computed(() =>
  (props.diffResult?.stats.total_left || 1)
)
const viewPort = ref(0) // visible lines
const scrollTop = ref(0)
const containerRef = ref<HTMLElement | null>(null)

const SEGMENT_H = 2 // px per segment

const segments = computed((): Seg[] => {
  if (!props.diffResult) return []
  const total = Math.max(props.diffResult.stats.total_left, 1)
  const segs: Seg[] = []
  for (const op of props.diffResult.ops) {
    if ('Equal' in op) {
      segs.push({ kind: 'eq', heightPx: op.Equal.count })
    } else if ('Delete' in op) {
      segs.push({ kind: 'del', heightPx: op.Delete.count })
    } else if ('Insert' in op) {
      segs.push({ kind: 'add', heightPx: op.Insert.count })
    } else if ('Replace' in op) {
      const mx = Math.max(op.Replace.left_count, op.Replace.right_count)
      segs.push({ kind: 'mod', heightPx: mx })
    }
  }
  return segs
})

// ── Scroll ratio ─────────────────────────────────────────────────────
const scrollPct = computed(() => {
  const total = Math.max(totalLines.value, 1)
  return Math.min(1, scrollTop.value / total)
})
const thumbPct = computed(() => {
  const total = Math.max(totalLines.value, 1)
  const visible = viewPort.value
  return Math.min(1, visible / total)
})

// ── Emit scroll position to parent (for navigation) ──────────────────
const emit = defineEmits<{
  scrollTo: [lineIndex: number]
}>()

function onClick(e: MouseEvent) {
  if (!props.diffResult || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const clickY = e.clientY - rect.top
  const totalH = segments.value.reduce((s, seg) => s + seg.heightPx * SEGMENT_H, 0)
  if (totalH === 0) return
  const ratio = clickY / totalH
  // Find which diff segment this corresponds to
  let acc = 0
  let lineIdx = 0
  for (const seg of segments.value) {
    const segEnd = acc + seg.heightPx
    if (ratio <= segEnd / totalLines.value) {
      // Inside this segment
      const segLocal = (ratio * totalLines.value - acc)
      lineIdx = opsLineIndex(Math.floor(segLocal))
      break
    }
    if (seg.kind !== 'eq') {
      acc += seg.heightPx
    }
    lineIdx += seg.heightPx
  }
  emit('scrollTo', Math.max(0, lineIdx))
}

function opsLineIndex(targetOpIdx: number): number {
  if (!props.diffResult) return 0
  let line = 0
  for (let i = 0; i < Math.min(targetOpIdx, props.diffResult.ops.length); i++) {
    const op = props.diffResult.ops[i]
    if ('Equal' in op) line += op.Equal.count
    else if ('Delete' in op) line += op.Delete.count
    else if ('Insert' in op) line += op.Insert.count
    else if ('Replace' in op) line += op.Replace.left_count
  }
  return line
}

// Track scroll state from parent via prop (set by parent diff pane)
function onScroll(e: Event) {
  const el = e.target as HTMLElement
  scrollTop.value = el.scrollTop
  viewPort.value = el.clientHeight / 22 // 22px line height
}
defineExpose({ onScroll })

const kindColors: Record<string, string> = {
  add: 'var(--color-green)',
  del: 'var(--color-red)',
  mod: 'var(--color-accent)',
  eq:  'transparent',
}
</script>

<template>
  <div
    ref="containerRef"
    class="minimap"
    @click="onClick"
    :title="diffResult ? `${diffResult.stats.added} added, ${diffResult.stats.deleted} deleted` : ''"
  >
    <!-- Diff density bar -->
    <div class="minimap-bar">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="minimap-seg"
        :class="`seg-${seg.kind}`"
        :style="{ height: `${Math.max(seg.heightPx * SEGMENT_H, 1)}px` }"
      />
    </div>

    <!-- Scroll position indicator -->
    <div
      v-if="diffResult"
      class="minimap-thumb"
      :style="{
        top: `${scrollPct * (100 - thumbPct * 100)}%`,
        height: `${Math.max(thumbPct * 100, 4)}%`,
      }"
    />
  </div>
</template>

<style scoped>
.minimap {
  width: 12px;
  flex-shrink: 0;
  position: relative;
  background: var(--color-bg3);
  border-left: 1px solid var(--color-border);
  cursor: crosshair;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.minimap-bar {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}
.minimap-seg { min-height: 1px; flex-shrink: 0; }
.seg-add { background: var(--color-green); opacity: 0.7; }
.seg-del { background: var(--color-red); opacity: 0.7; }
.seg-mod { background: var(--color-accent); opacity: 0.7; }
.seg-eq  { background: transparent; }

.minimap-thumb {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(255,255,255,0.25);
  border: 1px solid rgba(255,255,255,0.4);
  border-radius: 2px;
  pointer-events: none;
  transition: top 0.05s linear;
}
</style>
