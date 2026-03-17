<script setup lang="ts">
import { useTabStore } from '@/stores/tabs'
import { useRouter } from 'vue-router'

const tabStore = useTabStore()
const router = useRouter()

function handleClose(id: string, e: MouseEvent) {
  e.stopPropagation()
  const wasActive = tabStore.activeTabId === id
  tabStore.closeTab(id)
  if (wasActive) {
    const next = tabStore.activeTab
    if (next) router.push(tabStore.KIND_ROUTE[next.kind])
    else router.push('/')
  }
}

function handleClick(id: string) {
  const tab = tabStore.tabs.find(t => t.id === id)
  if (!tab) return
  tabStore.setActive(id)
  router.push(tabStore.KIND_ROUTE[tab.kind])
}
</script>

<template>
  <div class="tab-bar flex items-center overflow-x-auto">
    <!-- Home tab -->
    <div
      class="tab-item"
      :class="{ active: !tabStore.activeTabId && $route.path === '/' }"
      @click="router.push('/')"
    >
      <span class="tab-icon">⌂</span>
      <span>Home</span>
    </div>

    <div class="divider divider-v" style="height:20px;" />

    <!-- Dynamic tabs -->
    <div
      v-for="tab in tabStore.tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: tab.id === tabStore.activeTabId }"
      @click="handleClick(tab.id)"
    >
      <span class="tab-icon">{{ kindIcon(tab.kind) }}</span>
      <span class="truncate" style="max-width:160px">{{ tab.title }}</span>
      <span v-if="tab.isDirty" class="tab-dirty">●</span>
      <button class="tab-close btn-icon btn" @click="handleClose(tab.id, $event)">✕</button>
    </div>

    <!-- New tab button -->
    <button class="btn btn-icon tab-new" @click="router.push('/')">＋</button>
  </div>
</template>

<script lang="ts">
function kindIcon(kind: string) {
  const icons: Record<string, string> = {
    text_diff: '📄', folder_diff: '📁', table_diff: '📊',
    hex_diff: '🔢', image_diff: '🖼️'
  }
  return icons[kind] ?? '📄'
}
</script>

<style scoped>
.tab-bar {
  background: var(--color-bg3);
  border-bottom: 1px solid var(--color-border);
  min-height: 36px;
  padding: 0 4px;
  gap: 2px;
  flex-shrink: 0;
}
.tab-item {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 10px; border-radius: 4px 4px 0 0;
  cursor: pointer; font-size: 13px; color: var(--color-text-muted);
  border: 1px solid transparent; border-bottom: none;
  transition: all var(--transition); white-space: nowrap;
  user-select: none;
}
.tab-item:hover { background: var(--color-surface); color: var(--color-text); }
.tab-item.active {
  background: var(--color-bg); color: var(--color-text);
  border-color: var(--color-border); border-bottom-color: var(--color-bg);
}
.tab-icon { font-size: 12px; }
.tab-dirty { color: var(--color-accent); font-size: 10px; }
.tab-close {
  padding: 1px 4px; font-size: 10px; color: var(--color-text-muted);
  opacity: 0; transition: opacity var(--transition);
}
.tab-item:hover .tab-close, .tab-item.active .tab-close { opacity: 1; }
.tab-new { margin-left: 4px; font-size: 16px; color: var(--color-text-muted); }
</style>
