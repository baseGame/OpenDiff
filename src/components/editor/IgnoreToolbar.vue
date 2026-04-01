<script setup lang="ts">
import { Settings2, ArrowLeftRight, WrapText } from 'lucide-vue-next'

const props = defineProps<{
  ignoreWs: boolean
  ignoreCase: boolean
  ignoreComments: boolean
  showOnlyDiffs: boolean
  syncScroll: boolean
  wordWrap: boolean
  algorithm: string
}>()

const emit = defineEmits<{
  'update:ignoreWs': [v: boolean]
  'update:ignoreCase': [v: boolean]
  'update:ignoreComments': [v: boolean]
  'update:showOnlyDiffs': [v: boolean]
  'update:syncScroll': [v: boolean]
  'update:wordWrap': [v: boolean]
  'update:algorithm': [v: string]
  'change': []
}>()

function toggle(key: keyof typeof props, val: boolean) {
  emit(`update:${key}` as any, val)
  emit('change')
}
</script>

<template>
  <div class="ignore-toolbar flex items-center gap-4">
    <div class="toolbar-group flex items-center gap-3">
      <label class="opt" title="Ignore whitespace changes">
        <input type="checkbox" :checked="ignoreWs" @change="toggle('ignoreWs', ($event.target as HTMLInputElement).checked)" />
        <span>忽略空白</span>
      </label>
      <label class="opt" title="Ignore case changes">
        <input type="checkbox" :checked="ignoreCase" @change="toggle('ignoreCase', ($event.target as HTMLInputElement).checked)" />
        <span>忽略大小写</span>
      </label>
      <label class="opt" title="Ignore comments">
        <input type="checkbox" :checked="ignoreComments" @change="toggle('ignoreComments', ($event.target as HTMLInputElement).checked)" />
        <span>忽略注释</span>
      </label>
    </div>

    <div class="divider"></div>

    <div class="toolbar-group flex items-center gap-3">
      <label class="opt" title="Show only lines with differences">
        <input type="checkbox" :checked="showOnlyDiffs" @change="emit('update:showOnlyDiffs', ($event.target as HTMLInputElement).checked)" />
        <span>仅看差异</span>
      </label>
      <label class="opt" title="Synchronize scrolling between panes">
        <input type="checkbox" :checked="syncScroll" @change="emit('update:syncScroll', ($event.target as HTMLInputElement).checked)" />
        <ArrowLeftRight :size="12" class="mr-0.5" />
        <span>同步滚动</span>
      </label>
      <label class="opt" title="Wrap long lines">
        <input type="checkbox" :checked="wordWrap" @change="emit('update:wordWrap', ($event.target as HTMLInputElement).checked)" />
        <WrapText :size="12" class="mr-0.5" />
        <span>自动换行</span>
      </label>
    </div>

    <div class="flex-1" />

    <div class="toolbar-group flex items-center gap-2">
      <Settings2 :size="14" class="text-muted" />
      <select
        class="algo-select"
        :value="algorithm"
        @change="emit('update:algorithm', ($event.target as HTMLSelectElement).value); emit('change')"
      >
        <option value="histogram">Histogram</option>
        <option value="myers">Myers</option>
        <option value="patience">Patience</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.ignore-toolbar {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  padding: 4px 12px;
  flex-shrink: 0;
  font-size: 12px;
}
.toolbar-group {
  display: flex;
}
.divider {
  width: 1px;
  height: 14px;
  background-color: var(--color-border);
}
.opt {
  display: flex; align-items: center; gap: 4px;
  cursor: pointer; color: var(--color-text-muted);
  user-select: none;
  transition: color var(--transition);
}
.opt input { 
  accent-color: var(--color-accent); 
  cursor: pointer;
  margin: 0;
}
.opt:hover { color: var(--color-text); }
.opt:hover input { opacity: 0.9; }
.algo-select { 
  background: var(--color-bg2);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 6px; 
  font-size: 11px;
  outline: none;
  cursor: pointer;
  font-family: var(--font-ui);
}
.algo-select:hover {
  border-color: var(--color-border-hover);
}
.algo-select:focus {
  border-color: var(--color-accent);
}
</style>
