<script setup lang="ts">
/**
 * SearchBar — Ctrl+F 搜索栏，嵌入 TextDiffView 工具栏
 */
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  total: number   // total rows
}>()

const emit = defineEmits<{
  (e: 'jump', rowIndex: number): void
}>()

const query   = ref('')
const activeIdx = ref(-1)
const matchCount = ref(0)

const matchIndices = computed(() => {
  // We don't know rows here — parent will call setMatches
  return []
})

// External matches from parent
const _matches = ref<number[]>([])
watch(_matches, (m) => {
  matchCount.value = m.length
  if (m.length > 0 && activeIdx.value === -1) activeIdx.value = 0
  if (m.length === 0) activeIdx.value = -1
})

function setMatches(indices: number[]) {
  _matches.value = indices
  matchCount.value = indices.length
  activeIdx.value = indices.length > 0 ? 0 : -1
}

function prev() {
  if (matchCount.value === 0) return
  activeIdx.value = (activeIdx.value - 1 + matchCount.value) % matchCount.value
  emit('jump', _matches.value[activeIdx.value])
}

function next() {
  if (matchCount.value === 0) return
  activeIdx.value = (activeIdx.value + 1) % matchCount.value
  emit('jump', _matches.value[activeIdx.value])
}

function clear() {
  query.value = ''; _matches.value = []; matchCount.value = 0; activeIdx.value = -1
}

defineExpose({ setMatches, query })
</script>

<template>
  <div class="srch-bar">
    <span class="srch-icon">🔍</span>
    <input
      v-model="query"
      class="srch-input"
      placeholder="Search... (Ctrl+F)"
      @keydown.enter="next"
      @keydown.escape="clear"
    />
    <span v-if="matchCount > 0" class="srch-count">
      {{ activeIdx + 1 }}/{{ matchCount }}
    </span>
    <span v-else-if="query && matchCount === 0" class="srch-count srch-none">No match</span>
    <button class="srch-btn" @click="prev" title="Previous (Shift+F3)">↑</button>
    <button class="srch-btn" @click="next" title="Next (F3)">↓</button>
    <button class="srch-btn srch-close" @click="clear" title="Close (Esc)">✕</button>
  </div>
</template>

<style scoped>
.srch-bar { display:flex; align-items:center; gap:3px; background:var(--color-bg3); border:1px solid var(--color-border); border-radius:8px; padding:2px 6px; max-width:260px; }
.srch-icon { font-size:12px; flex-shrink:0 }
.srch-input { background:transparent; border:none; outline:none; color:var(--color-text); font-size:12px; width:140px }
.srch-input::placeholder { color:var(--color-text-muted) }
.srch-count { font-size:11px; color:var(--color-text-muted); white-space:nowrap; min-width:32px; text-align:center }
.srch-none { color:var(--color-red) }
.srch-btn { background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:11px; padding:2px 4px; border-radius:4px }
.srch-btn:hover { background:var(--color-surface); color:var(--color-text) }
.srch-close:hover { color:var(--color-red) }
</style>
