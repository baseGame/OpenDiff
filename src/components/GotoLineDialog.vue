<script setup lang="ts">
/**
 * GotoLineDialog — Ctrl+G 跳转到指定行号
 */
import { ref } from 'vue'

const props = defineProps<{ visible: boolean; maxLine: number }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'goto', line: number): void }>()

const inputVal = ref('')
const error = ref('')

function submit() {
  const n = parseInt(inputVal.value)
  if (isNaN(n) || n < 1 || n > props.maxLine) {
    error.value = `Line must be 1 – ${props.maxLine}`
    return
  }
  emit('goto', n)
  inputVal.value = ''; error.value = ''
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="gld-overlay" @click.self="emit('close')">
      <div class="gld-modal">
        <div class="gld-title">⬇ {{ $t('goto_line.title') || 'Go to Line' }}</div>
        <div class="gld-body">
          <div class="gld-label">{{ $t('goto_line.prompt') || 'Go to line number (1–{n})'.replace('{n}', String(maxLine)) }}</div>
          <input
            v-model="inputVal"
            class="gld-input"
            type="number"
            :min="1"
            :max="maxLine"
            :placeholder="`1 – ${maxLine}`"
            autofocus
            @keydown.enter="submit"
            @keydown.escape="emit('close')"
          />
          <div v-if="error" class="gld-error">{{ error }}</div>
        </div>
        <div class="gld-footer">
          <button class="gld-btn-cancel" @click="emit('close')">{{ $t('common.cancel') }}</button>
          <button class="gld-btn-go" @click="submit">{{ $t('goto_line.go') || 'Go' }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.gld-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px) }
.gld-modal { background:var(--color-bg2,#1e1e2e); border:1px solid var(--color-border,#3f3f46); border-radius:12px; width:320px; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,.5) }
.gld-title { padding:14px 20px 10px; font-size:13px; font-weight:700; color:var(--color-text,#f4f4f5); border-bottom:1px solid var(--color-border,#3f3f46) }
.gld-body { padding:14px 20px; display:flex; flex-direction:column; gap:8px }
.gld-label { font-size:12px; color:var(--color-text-muted,#a1a1aa) }
.gld-input { padding:7px 10px; border-radius:8px; border:1px solid var(--color-border,#3f3f46); background:var(--color-surface,#27272a); color:var(--color-text,#f4f4f5); font-size:13px; outline:none; width:100%; box-sizing:border-box }
.gld-input:focus { border-color:var(--color-accent,#3b82f6) }
.gld-error { font-size:11px; color:#ef4444 }
.gld-footer { padding:10px 20px; border-top:1px solid var(--color-border,#3f3f46); display:flex; justify-content:flex-end; gap:8px }
.gld-btn-cancel { padding:5px 14px; border-radius:8px; border:1px solid var(--color-border,#3f3f46); background:transparent; color:var(--color-text-muted,#a1a1aa); font-size:12px; cursor:pointer }
.gld-btn-go { padding:5px 14px; border-radius:8px; border:none; background:var(--color-accent,#3b82f6); color:white; font-size:12px; cursor:pointer; font-weight:600 }
.gld-btn-go:hover { background:#2563eb }
</style>
