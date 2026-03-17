<script setup lang="ts">
</script>
<template>
  <div class="status-bar flex items-center gap-2">
    <span class="text-muted text-xs">Ready</span>
    <div class="flex-1" />
    <span class="text-muted text-xs">OpenDiff v0.1.0</span>
  </div>
</template>
<style scoped>
.status-bar {
  background: var(--color-bg3);
  border-top: 1px solid var(--color-border);
  height: 24px; padding: 0 12px; flex-shrink: 0;
}
</style>
