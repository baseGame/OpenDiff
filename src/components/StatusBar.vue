<script setup lang="ts">
import { Zap, GitCommit, Settings } from 'lucide-vue-next'
</script>

<template>
  <div class="status-bar flex items-center gap-4">
    <div class="status-item flex items-center gap-1">
      <Zap :size="12" class="text-accent" />
      <span>Ready</span>
    </div>
    
    <div class="flex-1" />
    
    <div class="status-item flex items-center gap-1 cursor-pointer hover:text-text transition-colors">
      <GitCommit :size="12" />
      <span>v0.1.0</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  background: var(--color-bg2);
  border-top: 1px solid var(--color-border);
  height: 28px; 
  padding: 0 12px; 
  flex-shrink: 0;
  font-size: 11px;
  color: var(--color-text-muted);
}
.status-item {
  height: 100%;
  display: flex;
  align-items: center;
}
</style>
