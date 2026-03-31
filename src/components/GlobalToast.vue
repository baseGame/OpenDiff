<script setup lang="ts">
import { ref } from 'vue'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next'

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
  duration: number
}

const toasts = ref<Toast[]>([])
let nextId = 1

function show(message: string, type: Toast['type'] = 'info', duration = 3500) {
  const id = nextId++
  toasts.value.push({ id, type, message, duration })
  setTimeout(() => remove(id), duration)
}

function remove(id: number) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

// Expose globally via provide
defineExpose({ show })

// Also attach to window for easy access from anywhere
if (typeof window !== 'undefined') {
  (window as any).__toast = { show }
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast-${toast.type}`"
        >
          <CheckCircle2 v-if="toast.type === 'success'" :size="16" class="toast-icon" />
          <AlertCircle v-else-if="toast.type === 'error'" :size="16" class="toast-icon" />
          <Info v-else :size="16" class="toast-icon" />
          <span class="toast-msg">{{ toast.message }}</span>
          <button class="toast-close" @click="remove(toast.id)">
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 99999;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid;
  min-width: 220px;
  max-width: 380px;
  font-size: 13px;
  pointer-events: all;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.toast-success {
  background: rgba(22, 163, 74, 0.95);
  border-color: rgba(34, 197, 94, 0.3);
  color: white;
}

.toast-error {
  background: rgba(220, 38, 38, 0.95);
  border-color: rgba(239, 68, 68, 0.3);
  color: white;
}

.toast-info {
  background: rgba(30, 30, 46, 0.95);
  border-color: rgba(100, 100, 120, 0.3);
  color: white;
  backdrop-filter: blur(8px);
}

.toast-icon { flex-shrink: 0; }
.toast-msg { flex: 1; }
.toast-close {
  background: none; border: none; cursor: pointer;
  color: inherit; opacity: 0.6; padding: 2px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 0.15s;
}
.toast-close:hover { opacity: 1; }

/* Transition */
.toast-enter-active { animation: toast-in 0.25s ease-out; }
.toast-leave-active { animation: toast-out 0.2s ease-in forwards; }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(40px) scale(0.95); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to   { opacity: 0; transform: translateX(40px) scale(0.95); }
}
</style>
