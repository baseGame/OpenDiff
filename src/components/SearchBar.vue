<script setup lang="ts">
/**
 * SearchBar — Ctrl+F 搜索栏，集成到 TextDiffView
 * Supports: query binding, match indices, prev/next navigation
 */
import { ref, watch, nextTick } from 'vue'

const props = defineProps<{
  total?: number
  query?: string
  matchIdcs?: number[]
}>()

const emit = defineEmits<{
  (e: 'jump', rowIndex: number): void
  (e: 'update:query', q: string): void
}>()

const query = ref(props.query ?? '')
const matchCount = ref(0)
const activeIdx = ref(-1)

watch(() => props.query, (v) => { if (v !== undefined) query.value = v })
watch(() => props.matchIdcs, (m) => {
  matchCount.value = m?.length ?? 0
  activeIdx.value = m && m.length > 0 ? 0 : -1
})

function prev() {
  const m = props.matchIdcs ?? []
  if (!m.length) return
  activeIdx.value = (activeIdx.value - 1 + m.length) % m.length
  emit('jump', m[activeIdx.value])
}

function next() {
  const m = props.matchIdcs ?? []
  if (!m.length) return
  activeIdx.value = (activeIdx.value + 1) % m.length
  emit('jump', m[activeIdx.value])
}

function clear() {
  query.value = ''; activeIdx.value = -1; matchCount.value = 0
  emit('update:query', '')
}

function onInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value
  emit('update:query', query.value)
}

function focus() {
  nextTick(() => {
    const el = document.querySelector('.srch-input') as HTMLInputElement
    el?.focus()
    el?.select()
  })
}

defineExpose({ focus })
</script>

<template>
  <div class="srch-bar">
    <span class="srch-icon">🔍</span>
    <input
      class="srch-input"
      :value="query"
      placeholder="Search... (Ctrl+F)"
      @input="onInput"
      @keydown.enter="next"
      @keydown.escape="clear"
    />
    <span v-if="matchCount > 0" class="srch-count">
      {{ activeIdx + 1 }}/{{ matchCount }}
    </span>
    <span v-else-if="query && matchCount === 0" class="srch-count srch-none">✕</span>
    <button class="srch-btn" @click="prev" title="Previous">↑</button>
    <button class="srch-btn" @click="next" title="Next">↓</button>
    <button class="srch-btn srch-close" @click="clear" title="Clear">✕</button>
  </div>
</template>

<style scoped>
.srch-bar { display:flex; align-items:center; gap:3px; background:var(--color-bg3,#3f3f46); border:1px solid var(--color-border,#3f3f46); border-radius:8px; padding:2px 6px; max-width:240px; }
.srch-icon { font-size:12px; flex-shrink:0 }
.srch-input { background:transparent; border:none; outline:none; color:var(--color-text,#f4f4f5); font-size:12px; width:130px }
.srch-input::placeholder { color:var(--color-text-muted,#71717a) }
.srch-count { font-size:11px; color:var(--color-text-muted,#71717a); white-space:nowrap; min-width:28px; text-align:center }
.srch-none { color:var(--color-red,#ef4444) }
.srch-btn { background:transparent; border:none; color:var(--color-text-muted,#71717a); cursor:pointer; font-size:11px; padding:2px 4px; border-radius:4px; display:flex; align-items:center }
.srch-btn:hover { background:var(--color-surface,#27272a); color:var(--color-text,#f4f4f5) }
.srch-close:hover { color:var(--color-red,#ef4444) }
</style>
