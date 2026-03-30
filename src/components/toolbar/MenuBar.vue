<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTabStore } from '@/stores/tabs'
import type { SessionKind } from '@/types'
import { open } from '@tauri-apps/plugin-dialog'
import { Zap, Menu, FileText, FolderTree, Table, Binary, Image, Moon, Sun, Home, Info, LogOut } from 'lucide-vue-next'

const router = useRouter()
const tabStore = useTabStore()

const menuOpen = ref<string | null>(null)
const isDark = ref(document.documentElement.getAttribute('data-theme') !== 'light')

const menus = {
  File: [
    { label: 'New Text Compare…', icon: FileText, action: () => openDiff('text_diff') },
    { label: 'New Folder Compare…', icon: FolderTree, action: () => openDiff('folder_diff') },
    { label: 'New Table Compare…', icon: Table, action: () => openDiff('table_diff') },
    { label: 'New Hex Compare…', icon: Binary, action: () => openDiff('hex_diff') },
    { label: 'New Image Compare…', icon: Image, action: () => openDiff('image_diff') },
    null,
    { label: 'Exit', icon: LogOut, action: () => window.close(), danger: true },
  ],
  View: [
    { label: 'Toggle Theme', icon: isDark.value ? Sun : Moon, action: toggleTheme },
    { label: 'Home', icon: Home, action: () => router.push('/') },
  ],
  Help: [
    { label: 'About OpenDiff', icon: Info, action: () => alert('OpenDiff v0.1.0\nApache 2.0 | github.com/baseGame/OpenDiff') },
  ],
} as Record<string, any[]>

async function openDiff(kind: SessionKind) {
  menuOpen.value = null
  const left = await open({ multiple: false, title: 'Select Left File/Folder' })
  if (!left) return
  const right = await open({ multiple: false, title: 'Select Right File/Folder' })
  if (!right) return
  tabStore.openNewDiff(kind, left as string, right as string)
  router.push(tabStore.KIND_ROUTE[kind])
}

function toggleTheme() {
  const el = document.documentElement
  const cur = el.getAttribute('data-theme') ?? 'dark'
  const nextTheme = cur === 'dark' ? 'light' : 'dark'
  el.setAttribute('data-theme', nextTheme)
  isDark.value = nextTheme === 'dark'
  menus.View[0].icon = isDark.value ? Sun : Moon
  menuOpen.value = null
}
</script>

<template>
  <div class="menu-bar flex items-center" data-tauri-drag-region @click.self="menuOpen = null">
    <div class="app-logo flex items-center gap-2">
      <Zap :size="16" class="text-accent" />
      <span>OpenDiff</span>
    </div>

    <div class="menu-container flex items-center gap-1">
      <template v-for="(items, name) in menus" :key="name">
        <div class="menu-entry" :class="{ active: menuOpen === name }">
          <button class="menu-btn" @click="menuOpen = menuOpen === name ? null : name">
            {{ name }}
          </button>
          
          <div v-if="menuOpen === name" class="menu-dropdown shadow-lg" @click.stop>
            <template v-for="(item, i) in items">
              <div v-if="item === null" :key="`sep-${i}`" class="menu-sep" />
              <button 
                v-else 
                :key="item.label" 
                class="menu-item flex items-center gap-2" 
                :class="{ 'text-red hover:bg-red hover:bg-opacity-10': item.danger }"
                @click="item.action()"
              >
                <component :is="item.icon" :size="14" class="menu-icon" />
                <span>{{ item.label }}</span>
              </button>
            </template>
          </div>
        </div>
      </template>
    </div>
    
    <div class="drag-region flex-1 h-full" data-tauri-drag-region></div>
  </div>

  <!-- click outside to close -->
  <div v-if="menuOpen" class="menu-overlay" @click="menuOpen = null" />
</template>

<style scoped>
.menu-bar {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  height: 40px;
  padding: 0 12px;
  gap: 16px;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
  user-select: none;
}
.app-logo {
  font-weight: 600; 
  font-size: 14px; 
  color: var(--color-text);
  padding-right: 16px; 
  border-right: 1px solid var(--color-border);
}
.menu-entry { position: relative; }
.menu-btn {
  background: transparent; 
  border: none; 
  color: var(--color-text-muted);
  padding: 6px 12px; 
  font-size: 13px; 
  font-weight: 500;
  cursor: pointer; 
  border-radius: var(--radius-sm);
  transition: all var(--transition);
}
.menu-btn:hover, .menu-entry.active .menu-btn {
  background: var(--color-surface); 
  color: var(--color-text);
}
.menu-dropdown {
  position: absolute; 
  top: calc(100% + 4px); 
  left: 0;
  background: var(--color-surface); 
  border: 1px solid var(--color-border);
  border-radius: var(--radius); 
  min-width: 240px;
  z-index: 200; 
  padding: 6px;
}
.menu-item {
  display: flex; 
  width: 100%; 
  text-align: left;
  background: transparent; 
  border: none; 
  color: var(--color-text);
  padding: 8px 12px; 
  font-size: 13px; 
  cursor: pointer; 
  border-radius: var(--radius-sm);
  transition: background var(--transition);
}
.menu-item:hover { 
  background: var(--color-bg3); 
}
.menu-icon {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.menu-item:hover .menu-icon {
  color: var(--color-text);
}
.menu-item.text-red:hover .menu-icon {
  color: var(--color-red);
}
.menu-sep { 
  height: 1px; 
  background: var(--color-border); 
  margin: 6px 0; 
}
.menu-overlay {
  position: fixed; inset: 0; z-index: 99;
}
.drag-region {
  -webkit-app-region: drag;
}
</style>
