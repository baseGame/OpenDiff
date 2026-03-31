<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { FolderOpen, Search, GitBranch, Puzzle, Bug, User, Settings } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const activeItem = ref('explorer')

function onNav(id: string, path?: string) {
  activeItem.value = id
  if (path) router.push(path)
}

const topItems = [
  { id: 'explorer', icon: FolderOpen, title: 'Explorer' },
  { id: 'search', icon: Search, title: 'Search' },
  { id: 'source-control', icon: GitBranch, title: 'Source Control' },
  { id: 'extensions', icon: Puzzle, title: 'Extensions' },
  { id: 'debugger', icon: Bug, title: 'Debugger' },
]

const bottomItems = [
  { id: 'profile', icon: User, title: 'Profile' },
  { id: 'settings', icon: Settings, title: 'Settings', path: '/settings' },
]
</script>

<template>
  <aside class="side-nav-bar flex flex-col items-center py-2 border-r border-transparent">
    <div class="flex flex-col items-center gap-2 w-full">
      <button 
        v-for="item in topItems" 
        :key="item.id"
        class="nav-btn w-full py-3 flex items-center justify-center"
        :class="{ 'active': activeItem === item.id }"
        :title="item.title"
        @click="activeItem = item.id"
      >
        <component :is="item.icon" :size="20" class="nav-icon" />
      </button>
    </div>
    
    <div class="bottom-group flex flex-col items-center gap-2 w-full pb-4">
      <button 
        v-for="item in bottomItems" 
        :key="item.id"
        class="nav-btn w-full py-3 flex items-center justify-center"
        :class="{ 'active': item.path ? route.path === item.path : activeItem === item.id }"
        :title="item.title"
        @click="onNav(item.id, item.path)"
      >
        <component :is="item.icon" :size="20" class="nav-icon" />
      </button>
    </div>
  </aside>
</template>

<style scoped>
.side-nav-bar {
  background: var(--color-bg2);
  width: 48px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  z-index: 40;
}

.bottom-group {
  margin-top: auto;
}

.nav-btn {
  color: var(--color-text-muted);
  border-left: 2px solid transparent;
  background: transparent;
  cursor: pointer;
  border-right: none;
  border-top: none;
  border-bottom: none;
  transition: all var(--transition);
}

.nav-btn:hover {
  color: var(--color-text);
}

.nav-btn.active {
  color: var(--color-accent);
  border-left-color: var(--color-accent);
  background: var(--color-surface);
}

.nav-icon {
  stroke-width: 1.5;
}
</style>
