<script setup lang="ts">
import type { MergeResult, MergeLine } from '@/types'

const props = defineProps<{
  mergeResult: MergeResult | null
}>()

const emit = defineEmits<{
  'runMerge': []
  'close': []
}>()

function isMergeLine(line: MergeLine): line is { Resolved: string } {
  return 'Resolved' in line
}

function isConflict(line: MergeLine): line is { Conflict: { base: string[]; left: string[]; right: string[] } } {
  return 'Conflict' in line
}

function mergeText(result: MergeResult): string {
  return result.output_lines.map(line => {
    if (isMergeLine(line)) return line.Resolved
    const c = (line as any).Conflict
    return [
      '<<<<<<< LEFT',
      ...c.left,
      '||||||| BASE',
      ...c.base,
      '=======',
      ...c.right,
      '>>>>>>> RIGHT',
    ].join('\n')
  }).join('\n')
}
</script>

<template>
  <div class="merge-panel flex flex-col">
    <div class="merge-header flex items-center gap-2">
      <span class="bold">⊕ 三路合并输出</span>
      <template v-if="mergeResult">
        <span class="badge" :class="mergeResult.conflict_count ? 'badge-del' : 'badge-add'">
          {{ mergeResult.conflict_count ? `${mergeResult.conflict_count} 冲突` : '无冲突' }}
        </span>
      </template>
      <div class="flex-1" />
      <button class="btn btn-primary" @click="emit('runMerge')">执行合并</button>
      <button class="btn btn-icon" @click="emit('close')">✕</button>
    </div>
    <div class="merge-content font-mono flex-1 overflow-auto">
      <template v-if="mergeResult">
        <template v-for="(line, i) in mergeResult.output_lines" :key="i">
          <div v-if="'Resolved' in line" class="merge-line">{{ line.Resolved }}</div>
          <div v-else class="conflict-block">
            <div class="conflict-header left-header">◀ LEFT</div>
            <div class="conflict-line" v-for="(l, j) in (line as any).Conflict.left" :key="`l${j}`">{{ l }}</div>
            <div class="conflict-header base-header">│ BASE</div>
            <div class="conflict-base" v-for="(l, j) in (line as any).Conflict.base" :key="`b${j}`">{{ l }}</div>
            <div class="conflict-header right-header">▶ RIGHT</div>
            <div class="conflict-line right" v-for="(l, j) in (line as any).Conflict.right" :key="`r${j}`">{{ l }}</div>
          </div>
        </template>
      </template>
      <div v-else class="empty-merge text-muted">
        点击「执行合并」开始三路合并
      </div>
    </div>
  </div>
</template>

<style scoped>
.merge-panel {
  height: 220px; flex-shrink: 0;
  border-top: 2px solid var(--color-accent);
  background: var(--color-bg2);
}
.merge-header {
  padding: 6px 12px; border-bottom: 1px solid var(--color-border);
  background: var(--color-bg3); flex-shrink: 0;
}
.merge-content { font-size: 12px; line-height: 20px; }
.merge-line { padding: 0 12px; white-space: pre; }
.conflict-block { border: 1px solid var(--color-red); margin: 2px 8px; border-radius: 4px; overflow: hidden; }
.conflict-header { padding: 2px 8px; font-size: 11px; font-weight: 700; font-family: var(--font-ui); }
.left-header  { background: rgba(243,139,168,.2); color: var(--color-red); }
.base-header  { background: rgba(137,180,250,.1); color: var(--color-text-muted); }
.right-header { background: rgba(166,227,161,.2); color: var(--color-green); }
.conflict-line { padding: 0 12px; white-space: pre; background: rgba(243,139,168,.08); }
.conflict-line.right { background: rgba(166,227,161,.08); }
.conflict-base { padding: 0 12px; white-space: pre; background: rgba(137,180,250,.05); }
.empty-merge { padding: 32px; text-align: center; }
</style>
