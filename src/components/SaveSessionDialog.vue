<script setup lang="ts">
/**
 * SaveSessionDialog — 给当前 Session 命名保存
 */
import { ref, watch } from 'vue'
import type { SessionKind } from '@/types'

const props = defineProps<{
  visible: boolean
  kind: SessionKind
  leftPath: string
  rightPath: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', name: string, kind: SessionKind): void
}>()

const name = ref('')
const selectedKind = ref<SessionKind>(props.kind)

watch(() => props.visible, (v) => {
  if (v) {
    name.value = props.leftPath?.split('/').pop() || props.rightPath?.split('/').pop() || ''
    selectedKind.value = props.kind
  }
})

function save() {
  if (!name.value.trim()) return
  emit('save', name.value.trim(), selectedKind.value)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ssd-overlay" @click.self="emit('close')">
      <div class="ssd-modal">
        <div class="ssd-title">💾 保存 Session</div>
        <div class="ssd-body">
          <label class="ssd-label">Session 名称</label>
          <input v-model="name" class="ssd-input" placeholder="例如: my-project-config" autofocus @keydown.enter="save" />
          <div class="ssd-info" v-if="leftPath || rightPath">
            <div>📂 {{ leftPath || '—' }}</div>
            <div>📂 {{ rightPath || '—' }}</div>
          </div>
        </div>
        <div class="ssd-footer">
          <button class="ssd-btn-cancel" @click="emit('close')">取消</button>
          <button class="ssd-btn-save" @click="save" :disabled="!name.trim()">保存</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ssd-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.ssd-modal { background: var(--color-bg2, #1e1e2e); border: 1px solid var(--color-border, #3f3f46); border-radius: 12px; width: 420px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,.5); }
.ssd-title { padding: 16px 20px 12px; font-size: 14px; font-weight: 700; color: var(--color-text, #f4f4f5); border-bottom: 1px solid var(--color-border, #3f3f46); }
.ssd-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; }
.ssd-label { font-size: 12px; color: var(--color-text-muted, #a1a1aa); }
.ssd-input { padding: 7px 10px; border-radius: 8px; border: 1px solid var(--color-border, #3f3f46); background: var(--color-surface, #27272a); color: var(--color-text, #f4f4f5); font-size: 13px; outline: none; width: 100%; box-sizing: border-box; }
.ssd-input:focus { border-color: var(--color-accent, #3b82f6); }
.ssd-info { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--color-text-muted, #71717a); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ssd-footer { padding: 12px 20px; border-top: 1px solid var(--color-border, #3f3f46); display: flex; justify-content: flex-end; gap: 8px; }
.ssd-btn-cancel { padding: 6px 16px; border-radius: 8px; border: 1px solid var(--color-border, #3f3f46); background: transparent; color: var(--color-text-muted, #a1a1aa); font-size: 13px; cursor: pointer; }
.ssd-btn-cancel:hover { border-color: var(--color-text-muted, #71717a); color: var(--color-text, #f4f4f5); }
.ssd-btn-save { padding: 6px 16px; border-radius: 8px; border: none; background: var(--color-accent, #3b82f6); color: white; font-size: 13px; cursor: pointer; font-weight: 600; }
.ssd-btn-save:hover { background: #2563eb; }
.ssd-btn-save:disabled { opacity: .45; cursor: not-allowed; }
</style>
