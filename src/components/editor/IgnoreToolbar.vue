<script setup lang="ts">
defineProps<{
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

function toggle(key: string, val: boolean) {
  emit(`update:${key}` as any, val)
  emit('change')
}
</script>

<template>
  <div class="ignore-toolbar flex items-center gap-3">
    <label class="opt">
      <input type="checkbox" :checked="ignoreWs" @change="toggle('ignoreWs', ($event.target as HTMLInputElement).checked)" />
      忽略空白
    </label>
    <label class="opt">
      <input type="checkbox" :checked="ignoreCase" @change="toggle('ignoreCase', ($event.target as HTMLInputElement).checked)" />
      忽略大小写
    </label>
    <label class="opt">
      <input type="checkbox" :checked="ignoreComments" @change="toggle('ignoreComments', ($event.target as HTMLInputElement).checked)" />
      忽略注释
    </label>

    <div class="divider divider-v" style="height:14px" />

    <label class="opt">
      <input type="checkbox" :checked="showOnlyDiffs" @change="emit('update:showOnlyDiffs', ($event.target as HTMLInputElement).checked)" />
      仅差异
    </label>
    <label class="opt">
      <input type="checkbox" :checked="syncScroll" @change="emit('update:syncScroll', ($event.target as HTMLInputElement).checked)" />
      同步滚动
    </label>
    <label class="opt">
      <input type="checkbox" :checked="wordWrap" @change="emit('update:wordWrap', ($event.target as HTMLInputElement).checked)" />
      自动换行
    </label>

    <div class="flex-1" />

    <select
      class="input algo-select"
      :value="algorithm"
      @change="emit('update:algorithm', ($event.target as HTMLSelectElement).value); emit('change')"
    >
      <option value="histogram">Histogram</option>
      <option value="myers">Myers</option>
      <option value="patience">Patience</option>
    </select>
  </div>
</template>

<style scoped>
.ignore-toolbar {
  background: var(--color-bg3);
  border-bottom: 1px solid var(--color-border);
  padding: 3px 10px;
  flex-shrink: 0;
  font-size: 12px;
}
.opt {
  display: flex; align-items: center; gap: 4px;
  cursor: pointer; color: var(--color-text-muted);
  user-select: none;
}
.opt input { accent-color: var(--color-accent); cursor: pointer; }
.opt:hover { color: var(--color-text); }
.algo-select { width: 120px; padding: 3px 8px; font-size: 12px; }
</style>
