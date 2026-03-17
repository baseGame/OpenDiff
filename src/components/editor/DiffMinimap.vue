<script setup lang="ts">
import { computed } from 'vue'
import type { DiffResult } from '@/types'

const props = defineProps<{ diffResult: DiffResult | null }>()

const segments = computed(() => {
  if (!props.diffResult) return []
  const total = props.diffResult.stats.total_left || 1
  const segs: { kind: string; pct: number }[] = []
  for (const op of props.diffResult.ops) {
    if ('Delete' in op) segs.push({ kind: 'del', pct: op.Delete.count / total })
    else if ('Insert' in op) segs.push({ kind: 'add', pct: op.Insert.count / total })
    else if ('Replace' in op) segs.push({ kind: 'mod', pct: op.Replace.left_count / total })
  }
  return segs
})
</script>

<template>
  <div class="minimap" v-if="diffResult">
    <div
      v-for="(seg, i) in segments"
      :key="i"
      class="minimap-seg"
      :class="`seg-${seg.kind}`"
      :style="{ flexGrow: seg.pct }"
    />
  </div>
</template>

<style scoped>
.minimap {
  width: 10px; flex-shrink: 0; display: flex; flex-direction: column;
  background: var(--color-bg3); border-left: 1px solid var(--color-border);
  overflow: hidden;
}
.minimap-seg { min-height: 2px; }
.seg-add { background: var(--color-green); }
.seg-del { background: var(--color-red); }
.seg-mod { background: var(--color-accent); }
</style>
