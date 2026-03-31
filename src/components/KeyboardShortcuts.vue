<script setup lang="ts">
import { ref } from 'vue'

const show = ref(false)

const shortcuts = [
  { key: 'Ctrl + O', desc: '打开左侧文件' },
  { key: 'Ctrl + Shift + O', desc: '打开右侧文件' },
  { key: 'Ctrl + ,', desc: '打开设置' },
  { key: 'F3 / F8', desc: '下一个差异' },
  { key: 'F7', desc: '上一个差异' },
  { key: 'Ctrl + F', desc: '搜索' },
  { key: 'Escape', desc: '关闭面板 / 取消' },
  { key: '?', desc: '显示此帮助' },
]

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.key === '?') { show.value = !show.value }
  if (e.key === 'Escape') { show.value = false }
}

window.addEventListener('keydown', onKeydown)
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div v-if="show" class="shortcuts-backdrop" @click="show = false" />

    <!-- Panel -->
    <Transition name="panel">
      <div v-if="show" class="shortcuts-panel">
        <div class="shortcuts-header">
          <h3>⌨️ 键盘快捷键</h3>
          <button class="close-btn" @click="show = false">×</button>
        </div>
        <div class="shortcuts-list">
          <div v-for="s in shortcuts" :key="s.key" class="shortcut-row">
            <kbd class="shortcut-key">{{ s.key }}</kbd>
            <span class="shortcut-desc">{{ s.desc }}</span>
          </div>
        </div>
        <div class="shortcuts-footer">按 <kbd>?</kbd> 或 <kbd>Esc</kbd> 关闭</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.shortcuts-backdrop {
  position: fixed; inset: 0; z-index: 9998;
  background: rgba(0,0,0,0.4);
}
.shortcuts-panel {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9999;
  background: var(--color-surface, #1e1e2e);
  border: 1px solid var(--color-border, #3f3f46);
  border-radius: 12px;
  padding: 20px 24px;
  min-width: 320px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.4);
}
.shortcuts-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.shortcuts-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
.close-btn {
  background: none; border: none; color: var(--color-text-muted, #aaa);
  font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1;
  border-radius: 4px;
}
.close-btn:hover { color: var(--color-text, #fff); }
.shortcuts-list { display: flex; flex-direction: column; gap: 8px; }
.shortcut-row {
  display: flex; align-items: center; gap: 12px;
  font-size: 13px;
}
.shortcut-key {
  min-width: 160px;
  padding: 3px 8px;
  background: var(--color-bg2, #18181b);
  border: 1px solid var(--color-border, #3f3f46);
  border-radius: 6px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  text-align: center;
  color: var(--color-accent, #3b82f6);
}
.shortcut-desc { color: var(--color-text-muted, #aaa); }
.shortcuts-footer {
  margin-top: 16px; font-size: 11px; color: var(--color-text-muted, #666);
  text-align: center;
  border-top: 1px solid var(--color-border, #3f3f46);
  padding-top: 12px;
}
.shortcuts-footer kbd {
  background: var(--color-bg2, #18181b);
  border: 1px solid var(--color-border, #3f3f46);
  border-radius: 4px;
  padding: 1px 5px;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--color-accent, #3b82f6);
}

/* Transition */
.panel-enter-active { animation: panel-in 0.2s ease-out; }
.panel-leave-active { animation: panel-out 0.15s ease-in forwards; }
@keyframes panel-in {
  from { opacity: 0; transform: translate(-50%, calc(-50% + 12px)) scale(0.97); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}
@keyframes panel-out {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to   { opacity: 0; transform: translate(-50%, calc(-50% + 12px)) scale(0.97); }
}
</style>
