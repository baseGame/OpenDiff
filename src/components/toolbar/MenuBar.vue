<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTabStore } from '@/stores/tabs'
import type { SessionKind } from '@/types'
import { open } from '@tauri-apps/plugin-dialog'
import { Search, History, Settings, HelpCircle, Moon, Sun } from 'lucide-vue-next'

const router = useRouter()
const tabStore = useTabStore()

const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

async function openDiff(kind: SessionKind) {
  const isFolder = kind === 'folder_diff'
  const left = await open({ multiple: false, directory: isFolder, title: 'Select Left' })
  if (!left) return
  const right = await open({ multiple: false, directory: isFolder, title: 'Select Right' })
  if (!right) return
  tabStore.openNewDiff(kind, left as string, right as string)
  router.push(tabStore.KIND_ROUTE[kind] || '/')
}

function toggleTheme() {
  const el = document.documentElement
  const cur = el.getAttribute('data-theme') ?? 'dark'
  const nextTheme = cur === 'dark' ? 'light' : 'dark'
  el.setAttribute('data-theme', nextTheme)
  isDark.value = nextTheme === 'dark'
}
</script>

<template>
  <header class="top-nav-bar flex items-center justify-between w-full px-3" data-tauri-drag-region>
    <!-- Left Section -->
    <div class="flex items-center gap-4 h-full" data-tauri-drag-region>
      <span class="text-lg font-bold tracking-tighter text-text app-title" @click="router.push('/')">OpenDiff</span>
      
      <nav class="nav-menu flex items-center gap-2 h-full">
        <button class="nav-link" @click="openDiff('folder_diff')">Folder Compare</button>
        <button class="nav-link" @click="openDiff('text_diff')">Text Compare</button>
        <button class="nav-link" @click="openDiff('image_diff')">Image Compare</button>
        <button class="nav-link" @click="openDiff('hex_diff')">Hex Compare</button>
      </nav>
    </div>

    <!-- Right Section -->
    <div class="flex items-center gap-2">
      <div class="search-box rounded flex items-center gap-2">
        <Search :size="14" class="text-muted" />
        <input 
          class="bg-transparent border-none text-xs focus:outline-none p-0 w-32 placeholder:text-muted text-text" 
          placeholder="Quick find..." 
          type="text"
        />
      </div>
      
      <button class="icon-btn rounded" title="Recent History" @click="router.push('/')">
        <History :size="16" />
      </button>
      <button class="icon-btn rounded" title="Toggle Theme" @click="toggleTheme">
        <component :is="isDark ? Sun : Moon" :size="16" />
      </button>
      <button class="icon-btn rounded" title="Help">
        <HelpCircle :size="16" />
      </button>
    </div>
  </header>
  <div class="header-divider w-full"></div>
</template>

<style scoped>
.top-nav-bar {
  background: var(--color-bg);
  height: 40px;
  z-index: 50;
  /* The entire header should be draggable where there are no interactive elements */
}

.app-title {
  color: var(--color-text);
  cursor: pointer;
  margin-right: 16px;
  /* Make sure title doesn't block dragging */
  -webkit-app-region: no-drag; 
}

@media (max-width: 768px) {
  .nav-menu {
    display: none !important;
  }
}

.nav-link {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  -webkit-app-region: no-drag;
}

.nav-link:hover {
  color: var(--color-text);
  background: var(--color-bg3);
}

.search-box {
  background: var(--color-bg2);
  padding: 4px 8px;
  -webkit-app-region: no-drag;
}

.search-box input {
  font-family: var(--font-ui);
}

.icon-btn {
  padding: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
}

.icon-btn:hover {
  background: var(--color-bg3);
  color: var(--color-text);
}

.header-divider {
  height: 1px;
  background: var(--color-border);
}
</style>
