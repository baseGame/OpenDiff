<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTabStore } from '@/stores/tabs'
import type { SessionKind } from '@/types'
import { open } from '@tauri-apps/plugin-dialog'

const router = useRouter()
const tabStore = useTabStore()

const menu = ref<string | null>(null)

const menus = {
  File: [
    { label: 'New Text Compare…', action: () => openDiff('text_diff') },
    { label: 'New Folder Compare…', action: () => openDiff('folder_diff') },
    { label: 'New Table Compare…', action: () => openDiff('table_diff') },
    { label: 'New Hex Compare…', action: () => openDiff('hex_diff') },
    { label: 'New Image Compare…', action: () => openDiff('image_diff') },
    null,
    { label: 'Exit', action: () => window.close() },
  ],
  View: [
    { label: 'Toggle Theme', action: toggleTheme },
    { label: 'Home', action: () => router.push('/') },
  ],
  Help: [
    { label: 'About OpenDiff', action: () => alert('OpenDiff v0.1.0\nApache 2.0 | github.com/baseGame/OpenDiff') },
  ],
} as Record<string, any[]>

async function openDiff(kind: SessionKind) {
  menu.value = null
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
  el.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark')
  menu.value = null
}
</script>

<template>
  <div class="menu-bar flex items-center" @click.self="menu = null">
    <div class="app-logo">⚡ OpenDiff</div>

    <template v-for="(items, name) in menus" :key="name">
      <div class="menu-entry" :class="{ active: menu === name }">
        <button class="menu-btn" @click="menu = menu === name ? null : name">
          {{ name }}
        </button>
        <div v-if="menu === name" class="menu-dropdown" @click.stop>
          <template v-for="(item, i) in items">
            <div v-if="item === null" :key="`sep-${i}`" class="menu-sep" />
            <button v-else :key="item.label" class="menu-item" @click="item.action()">
              {{ item.label }}
            </button>
          </template>
        </div>
      </div>
    </template>
  </div>

  <!-- click outside to close -->
  <div v-if="menu" class="menu-overlay" @click="menu = null" />
</template>

<style scoped>
.menu-bar {
  background: var(--color-bg3);
  border-bottom: 1px solid var(--color-border);
  height: 32px;
  padding: 0 8px;
  gap: 0;
  flex-shrink: 0;
  position: relative;
  z-index: 100;
}
.app-logo {
  font-weight: 700; font-size: 13px; color: var(--color-accent);
  padding: 0 12px 0 4px; margin-right: 4px;
  border-right: 1px solid var(--color-border);
}
.menu-entry { position: relative; }
.menu-btn {
  background: none; border: none; color: var(--color-text-muted);
  padding: 6px 10px; font-size: 13px; cursor: pointer; border-radius: 4px;
  transition: all var(--transition);
}
.menu-btn:hover, .menu-entry.active .menu-btn {
  background: var(--color-surface); color: var(--color-text);
}
.menu-dropdown {
  position: absolute; top: calc(100% + 2px); left: 0;
  background: var(--color-bg2); border: 1px solid var(--color-border);
  border-radius: var(--radius); min-width: 220px;
  box-shadow: 0 8px 24px rgba(0,0,0,.4); z-index: 200; padding: 4px;
}
.menu-item {
  display: block; width: 100%; text-align: left;
  background: none; border: none; color: var(--color-text);
  padding: 7px 12px; font-size: 13px; cursor: pointer; border-radius: 4px;
  transition: background var(--transition);
}
.menu-item:hover { background: var(--color-surface); }
.menu-sep { height: 1px; background: var(--color-border); margin: 4px 0; }
.menu-overlay {
  position: fixed; inset: 0; z-index: 99;
}
</style>
