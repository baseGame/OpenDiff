<script setup lang="ts">
import { useTabStore } from '@/stores/tabs'
import { useRouter } from 'vue-router'
import { Home, FileText, FolderTree, Table, Binary, Image, X, Plus, Circle } from 'lucide-vue-next'

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

const getIcon = (kind: string) => {
  const icons: Record<string, any> = {
    text_diff: FileText, 
    folder_diff: FolderTree, 
    table_diff: Table,
    hex_diff: Binary, 
    image_diff: Image
  }
  return icons[kind] ?? FileText
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
      <Home :size="14" class="tab-icon" />
      <span>Home</span>
    </div>

    <!-- Dynamic tabs -->
    <div
      v-for="tab in tabStore.tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: tab.id === tabStore.activeTabId }"
      @click="handleClick(tab.id)"
    >
      <component :is="getIcon(tab.kind)" :size="14" class="tab-icon" />
      <span class="truncate tab-title">{{ tab.title }}</span>
      
      <div class="tab-actions flex items-center justify-center">
        <Circle v-if="tab.isDirty" :size="8" class="tab-dirty" fill="currentColor" />
        <button class="tab-close flex items-center justify-center" @click="handleClose(tab.id, $event)">
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- New tab button -->
    <button class="tab-new flex items-center justify-center" @click="router.push('/')">
      <Plus :size="16" />
    </button>
  </div>
</template>

<style scoped>
.tab-bar {
  background: var(--color-bg2);
  min-height: 38px;
  padding: 0 8px;
  gap: 4px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border);
}

.tab-bar::-webkit-scrollbar {
  height: 0px; /* Hide scrollbar for tab bar */
}

.tab-item {
  display: flex; 
  align-items: center; 
  gap: 8px;
  padding: 0 12px; 
  height: 30px;
  border-radius: var(--radius-sm);
  cursor: pointer; 
  font-size: 13px; 
  color: var(--color-text-muted);
  transition: all var(--transition); 
  white-space: nowrap;
  user-select: none;
  background: transparent;
  border: 1px solid transparent;
  max-width: 200px;
}

.tab-item:hover { 
  background: var(--color-surface); 
  color: var(--color-text); 
}

.tab-item.active {
  background: var(--color-bg); 
  color: var(--color-text);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 0 var(--color-bg) inset;
}

.tab-icon { 
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.tab-item.active .tab-icon {
  color: var(--color-accent);
}

.tab-title {
  flex: 1;
}

.tab-actions {
  width: 16px;
  height: 16px;
  position: relative;
  flex-shrink: 0;
}

.tab-dirty { 
  color: var(--color-accent); 
  position: absolute;
}

.tab-close {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  width: 100%;
  height: 100%;
  cursor: pointer;
  opacity: 0; 
  transition: all 100ms ease;
  position: absolute;
}

.tab-close:hover {
  background: var(--color-bg3);
  color: var(--color-text);
}

.tab-item:hover .tab-close, .tab-item.active .tab-close { 
  opacity: 1; 
}
.tab-item:hover .tab-dirty {
  opacity: 0; /* Hide dirty dot when hovered so close button can show */
}

.tab-new { 
  background: transparent;
  border: none;
  margin-left: 4px; 
  color: var(--color-text-muted);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition);
}

.tab-new:hover {
  background: var(--color-surface);
  color: var(--color-text);
}
</style>
