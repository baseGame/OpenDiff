<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const show = ref(false)
const query = ref('')
const selected = ref(0)

const commands = [
  { id: 'text-diff',   label: 'New Text Compare',   icon: '📄', action: () => router.push('/text-diff') },
  { id: 'folder-diff',label: 'New Folder Compare',  icon: '📁', action: () => router.push('/folder-diff') },
  { id: 'table-diff', label: 'New Table Compare',   icon: '📊', action: () => router.push('/table-diff') },
  { id: 'hex-diff',   label: 'New Hex Compare',     icon: '🔣', action: () => router.push('/hex-diff') },
  { id: 'image-diff', label: 'New Image Compare',   icon: '🖼', action: () => router.push('/image-diff') },
  { id: 'settings',   label: 'Open Settings',        icon: '⚙', action: () => router.push('/settings') },
  { id: 'home',      label: 'Go to Home',           icon: '🏠', action: () => router.push('/') },
  { id: 'light',     label: 'Light Theme',          icon: '☀️', action: () => document.documentElement.setAttribute('data-theme', 'light') },
  { id: 'dark',      label: 'Dark Theme',            icon: '🌙', action: () => document.documentElement.setAttribute('data-theme', 'dark') },
  { id: 'auto-theme',label: 'Auto Theme',            icon: '🌓', action: () => document.documentElement.removeAttribute('data-theme') },
]

const filtered = computed(() => {
  if (!query.value.trim()) return commands
  const q = query.value.toLowerCase()
  return commands.filter(c => c.label.toLowerCase().includes(q) || c.id.includes(q))
})

function execute(cmd: any) {
  cmd.action()
  show.value = false
  query.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
    e.preventDefault()
    show.value = !show.value
    if (!show.value) { query.value = ''; selected.value = 0 }
  }
  if (!show.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); selected.value = Math.min(selected.value + 1, filtered.value.length - 1) }
  if (e.key === 'ArrowUp') { e.preventDefault(); selected.value = Math.max(selected.value - 1, 0) }
  if (e.key === 'Enter') { e.preventDefault(); if (filtered.value[selected.value]) execute(filtered.value[selected.value]) }
  if (e.key === 'Escape') { show.value = false; query.value = '' }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <!-- Trigger badge -->
  <div class="cp-trigger" @click="show = true" title="Command Palette (Ctrl+Shift+P)">
    ⌘
  </div>

  <!-- Overlay -->
  <Teleport to="body">
    <div v-if="show" class="cp-overlay" @click.self="show = false">
      <div class="cp-dialog">
        <div class="cp-input-row">
          <span class="cp-icon">⌘</span>
          <input
            v-model="query"
            class="cp-input"
            placeholder="Type a command…"
            autofocus
          />
        </div>
        <div class="cp-list">
          <div v-if="!filtered.length" class="cp-empty">No commands found</div>
          <div
            v-for="(cmd, i) in filtered"
            :key="cmd.id"
            class="cp-item"
            :class="{ active: i === selected }"
            @click="execute(cmd)"
            @mouseenter="selected = i"
          >
            <span class="cp-item-icon">{{ cmd.icon }}</span>
            <span class="cp-item-label">{{ cmd.label }}</span>
            <span class="cp-item-id">{{ cmd.id }}</span>
          </div>
        </div>
        <div class="cp-footer">
          <span>↑↓ navigate</span>
          <span>↵ run</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cp-trigger {
  cursor: pointer;
  padding:2px 8px;
  border-radius:4px;
  font-size:12px;
  color:var(--color-text-muted);
  background:var(--color-surface);
  border:1px solid var(--color-border);
}
.cp-trigger:hover {
  border-color:var(--color-accent);
  color:var(--color-accent);
}
.cp-overlay {
  position:fixed;
  inset:0;
  z-index:9999;
  background:rgba(0,0,0,.55);
  display:flex;
  align-items:flex-start;
  justify-content:center;
  padding-top:14vh;
}
.cp-dialog {
  background:var(--color-surface);
  border:1px solid var(--color-border);
  border-radius:12px;
  width:560px;
  max-width:92vw;
  box-shadow:var(--shadow-lg);
  overflow:hidden;
}
.cp-input-row {
  display:flex;
  align-items:center;
  gap:10px;
  padding:14px 16px;
  border-bottom:1px solid var(--color-border);
}
.cp-icon { font-size:16px; color:var(--color-text-muted) }
.cp-input {
  flex:1;
  background:none;
  border:none;
  outline:none;
  font-size:15px;
  color:var(--color-text);
}
.cp-input::placeholder { color:var(--color-text-muted) }
.cp-list { max-height:360px; overflow-y:auto }
.cp-empty {
  padding:20px;
  text-align:center;
  color:var(--color-text-muted);
  font-size:13px;
}
.cp-item {
  display:flex;
  align-items:center;
  gap:10px;
  padding:9px 16px;
  cursor:pointer;
  font-size:13px;
}
.cp-item:hover, .cp-item.active { background:var(--color-bg-hover) }
.cp-item.active { background:rgba(59,130,246,.08) }
.cp-item-icon { font-size:14px; width:20px; text-align:center; flex-shrink:0 }
.cp-item-label { flex:1 }
.cp-item-id {
  font-size:10px;
  color:var(--color-text-muted);
  padding:1px 6px;
  background:var(--color-bg2);
  border-radius:4px;
}
.cp-footer {
  display:flex;
  gap:16px;
  padding:7px 16px;
  border-top:1px solid var(--color-border);
  font-size:11px;
  color:var(--color-text-muted);
}
</style>
