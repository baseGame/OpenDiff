<script setup lang="ts">
import type { MergeResult, MergeLine } from '@/types'
import { GitMerge, X, Play, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Equal } from 'lucide-vue-next'

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
    <div class="merge-header flex items-center gap-3">
      <div class="flex items-center gap-2 text-accent font-semibold">
        <GitMerge :size="16" />
        <span>三路合并输出</span>
      </div>
      
      <template v-if="mergeResult">
        <div class="status-badge flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
             :class="mergeResult.conflict_count ? 'bg-red-500/10 text-red' : 'bg-green-500/10 text-green'">
          <AlertCircle v-if="mergeResult.conflict_count" :size="12" />
          <CheckCircle2 v-else :size="12" />
          <span>{{ mergeResult.conflict_count ? `${mergeResult.conflict_count} 冲突` : '无冲突' }}</span>
        </div>
      </template>
      
      <div class="flex-1" />
      
      <div class="flex items-center gap-2">
        <button class="btn btn-primary btn-sm flex items-center gap-1" @click="emit('runMerge')">
          <Play :size="14" />
          <span>执行合并</span>
        </button>
        <button class="btn btn-icon rounded-sm hover:text-red transition-colors" title="关闭合并面板" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
    </div>
    
    <div class="merge-content font-mono flex-1 overflow-auto">
      <template v-if="mergeResult">
        <template v-for="(line, i) in mergeResult.output_lines" :key="i">
          <div v-if="'Resolved' in line" class="merge-line">{{ line.Resolved || ' ' }}</div>
          <div v-else class="conflict-block">
            <div class="conflict-header left-header flex items-center gap-2">
              <ChevronLeft :size="12" /> <span>LEFT</span>
            </div>
            <div class="conflict-line" v-for="(l, j) in (line as any).Conflict.left" :key="`l${j}`">{{ l || ' ' }}</div>
            
            <div class="conflict-header base-header flex items-center gap-2">
              <Equal :size="12" /> <span>BASE</span>
            </div>
            <div class="conflict-base" v-for="(l, j) in (line as any).Conflict.base" :key="`b${j}`">{{ l || ' ' }}</div>
            
            <div class="conflict-header right-header flex items-center gap-2">
              <ChevronRight :size="12" /> <span>RIGHT</span>
            </div>
            <div class="conflict-line right" v-for="(l, j) in (line as any).Conflict.right" :key="`r${j}`">{{ l || ' ' }}</div>
          </div>
        </template>
      </template>
      <div v-else class="empty-merge flex flex-col items-center justify-center text-muted gap-3 h-full">
        <GitMerge :size="32" class="opacity-50" />
        <span>点击右上角「执行合并」开始三路合并</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.merge-panel {
  height: 240px; flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
}
.merge-header {
  padding: 8px 16px; border-bottom: 1px solid var(--color-border);
  background: var(--color-bg2); flex-shrink: 0;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.status-badge {
  font-weight: 500;
  border: 1px solid currentColor;
}
.bg-red-500\/10 { background-color: rgba(239, 68, 68, 0.1); }
.bg-green-500\/10 { background-color: rgba(34, 197, 94, 0.1); }

.merge-content { 
  font-size: 13px; 
  line-height: 1.6; 
  padding: 8px 0;
}
.merge-line { 
  padding: 0 16px; 
  white-space: pre; 
  color: var(--color-text);
}
.merge-line:hover {
  background: var(--color-bg2);
}
.conflict-block { 
  border: 1px solid var(--color-border); 
  margin: 8px 16px; 
  border-radius: var(--radius); 
  overflow: hidden; 
  box-shadow: var(--shadow-sm);
}
.conflict-header { 
  padding: 4px 12px; 
  font-size: 11px; 
  font-weight: 600; 
  font-family: var(--font-ui); 
  letter-spacing: 0.5px;
}
.left-header  { background: rgba(243,139,168,.15); color: var(--color-red); border-bottom: 1px solid rgba(243,139,168,.2); }
.base-header  { background: rgba(137,180,250,.1); color: var(--color-text-muted); border-top: 1px solid rgba(137,180,250,.2); border-bottom: 1px solid rgba(137,180,250,.2); }
.right-header { background: rgba(166,227,161,.15); color: var(--color-green); border-top: 1px solid rgba(166,227,161,.2); }

.conflict-line { padding: 2px 12px; white-space: pre; background: rgba(243,139,168,.05); color: var(--color-text); }
.conflict-line.right { background: rgba(166,227,161,.05); }
.conflict-base { padding: 2px 12px; white-space: pre; background: rgba(137,180,250,.05); color: var(--color-text-muted); }

.empty-merge { padding: 32px; text-align: center; }
</style>
