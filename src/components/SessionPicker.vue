<script setup lang="ts">
/**
 * SessionPicker — 快速切换 / 加载已保存的 Session
 * 触发: Ctrl+Shift+S 或点击工具栏按钮
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { save, open } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useRouter } from 'vue-router'
import { listRecentSessions, deleteSession } from '@/api'
import type { Session, SessionKind } from '@/types'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'load', s: Session): void }>()

const router = useRouter()
const sessions = ref<Session[]>([])
const activeKind = ref<SessionKind | 'all'>('all')
const search = ref('')
const loading = ref(false)
const confirmDelete = ref<string | null>(null)

async function exportSessions() {
  if (!sessions.value.length) return
  const path = await save({
    defaultPath: 'opendiff-sessions.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  } as any)
  if (!path) return
  try {
    const data = JSON.stringify(sessions.value, null, 2)
    await writeTextFile(path, data)
    ;(window as any).__toast?.('Sessions exported!')
  } catch (e) { console.error(e) }
}

async function importSessions() {
  const paths = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }]
  } as any) as string | null
  if (!paths) return
  try {
    const text = await readTextFile(paths)
    const imported = JSON.parse(text)
    if (!Array.isArray(imported)) return
    for (const s of imported) {
      try { await saveSession(s); sessions.value.unshift(s) } catch { /* skip duplicates */ }
    }
    ;(window as any).__toast?.(`Imported ${imported.length} sessions`)
  } catch (e) { console.error(e) }
}

const kinds: { label: string; value: SessionKind | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '📝 文本', value: 'text_diff' },
  { label: '📂 文件夹', value: 'folder_diff' },
  { label: '📊 表格', value: 'table_diff' },
  { label: '🔢 Hex', value: 'hex_diff' },
  { label: '🖼 图片', value: 'image_diff' },
]

const filtered = computed(() => {
  let list = sessions.value
  if (activeKind.value !== 'all') list = list.filter(s => s.kind === activeKind.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.left_path.toLowerCase().includes(q) || s.right_path.toLowerCase().includes(q))
  }
  return list
})

async function load() {
  loading.value = true
  try { sessions.value = await listRecentSessions(50) }
  catch { sessions.value = [] }
  finally { loading.value = false }
}

function kindLabel(k: SessionKind) {
  return { text_diff: '📝', folder_diff: '📂', table_diff: '📊', hex_diff: '🔢', image_diff: '🖼', folder_sync: '🔄' }[k] ?? '📄'
}

function timeAgo(ts: string) {
  const d = new Date(ts)
  const now = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

function openSession(s: Session) {
  emit('load', s)
  emit('close')
}

async function doDelete(id: string) {
  try { await deleteSession(id); sessions.value = sessions.value.filter(s => s.id !== id) }
  catch { /* ignore */ }
  confirmDelete.value = null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => { load(); window.addEventListener('keydown', onKeydown) })
onUnmounted(() => { window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="sp-overlay" @click.self="emit('close')">
      <div class="sp-modal">

        <!-- Header -->
        <div class="sp-hdr">
          <div class="sp-title">{{ $t('session_picker.title') || '📂 切换 Session' }}</div>
          <div class="sp-hdr-actions">
            <button class="sp-action-btn" @click="importSessions" title="Import sessions">⬆ Import</button>
            <button class="sp-action-btn" @click="exportSessions" title="Export all">⬇ Export</button>
          </div>
          <div class="sp-search-row">
            <input v-model="search" class="sp-search" :placeholder="$t('session_picker.search') || '搜索 Session...'" autofocus />
          </div>
        </div>

        <!-- Kind tabs -->
        <div class="sp-kinds">
          <button v-for="k in kinds" :key="k.value" class="sp-kind-btn"
            :class="{ active: activeKind === k.value }"
            @click="activeKind = k.value as any">
            {{ k.label }}
          </button>
        </div>

        <!-- Session list -->
        <div class="sp-body">
          <div v-if="loading" class="sp-empty">加载中...</div>
          <div v-else-if="!filtered.length" class="sp-empty">
            <div class="sp-empty-icon">📂</div>
            <div>暂无 Session</div>
            <div class="sp-empty-sub">打开文件后会自动保存到这里</div>
          </div>
          <div v-else class="sp-list">
            <div v-for="s in filtered" :key="s.id" class="sp-item"
              @dblclick="openSession(s)">
              <div class="sp-item-icon">{{ kindLabel(s.kind) }}</div>
              <div class="sp-item-body">
                <div class="sp-item-name">{{ s.name }}</div>
                <div class="sp-item-paths">
                  <span v-if="s.left_path" class="sp-path">← {{ s.left_path.split('/').pop() }}</span>
                  <span v-if="s.right_path" class="sp-path">↔ {{ s.right_path.split('/').pop() }}</span>
                </div>
                <div class="sp-item-time">{{ timeAgo(s.updated_at) }}</div>
              </div>
              <div class="sp-item-actions">
                <button class="sp-btn-load" @click.stop="openSession(s)">{{ $t('session_picker.load') || '加载' }}</button>
                <button class="sp-btn-del" @click.stop="confirmDelete = s.id">✕</button>
              </div>
              <!-- Delete confirm -->
              <div v-if="confirmDelete === s.id" class="sp-del-confirm" @click.stop>
                <span>确定删除？</span>
                <button class="sp-btn-confirm-yes" @click="doDelete(s.id)">是</button>
                <button class="sp-btn-confirm-no" @click="confirmDelete = null">否</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="sp-footer">
          <span class="sp-hint">双击打开 · Del 删除 · Esc 关闭</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sp-overlay { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
.sp-modal { background: var(--color-bg2, #1e1e2e); border: 1px solid var(--color-border, #3f3f46); border-radius: 12px; width: 680px; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,.5); }
.sp-hdr { padding: 16px 16px 8px; border-bottom: 1px solid var(--color-border, #3f3f46); }
.sp-title { font-size: 14px; font-weight: 700; color: var(--color-text, #f4f4f5); margin-bottom: 8px; }
.sp-search-row { display: flex; gap: 8px; }
.sp-search { flex: 1; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--color-border, #3f3f46); background: var(--color-surface, #27272a); color: var(--color-text, #f4f4f5); font-size: 13px; outline: none; }
.sp-search:focus { border-color: var(--color-accent, #3b82f6); }
.sp-kinds { display: flex; gap: 4px; padding: 8px 16px; border-bottom: 1px solid var(--color-border, #3f3f46); overflow-x: auto; flex-shrink: 0; }
.sp-kind-btn { padding: 3px 10px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: var(--color-text-muted, #a1a1aa); font-size: 12px; cursor: pointer; white-space: nowrap; transition: all .15s; }
.sp-kind-btn:hover { border-color: var(--color-border, #3f3f46); color: var(--color-text, #f4f4f5); }
.sp-kind-btn.active { border-color: var(--color-accent, #3b82f6); background: rgba(59,130,246,.12); color: var(--color-accent, #3b82f6); }
.sp-body { flex: 1; overflow-y: auto; }
.sp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; color: var(--color-text-muted, #a1a1aa); gap: 8px; }
.sp-empty-icon { font-size: 36px; }
.sp-empty-sub { font-size: 12px; color: var(--color-text-muted, #71717a); }
.sp-list { padding: 8px; }
.sp-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: background .1s; position: relative; border: 1px solid transparent; }
.sp-item:hover { background: var(--color-surface, #27272a); border-color: var(--color-border, #3f3f46); }
.sp-item-icon { font-size: 20px; flex-shrink: 0; }
.sp-item-body { flex: 1; min-width: 0; }
.sp-item-name { font-size: 13px; font-weight: 600; color: var(--color-text, #f4f4f5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-item-paths { display: flex; gap: 8px; margin-top: 2px; }
.sp-path { font-size: 11px; color: var(--color-text-muted, #a1a1aa); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.sp-item-time { font-size: 10px; color: var(--color-text-muted, #71717a); margin-top: 2px; }
.sp-item-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.sp-btn-load { padding: 3px 10px; border-radius: 6px; border: 1px solid var(--color-accent, #3b82f6); background: rgba(59,130,246,.1); color: var(--color-accent, #3b82f6); font-size: 11px; cursor: pointer; }
.sp-btn-load:hover { background: rgba(59,130,246,.2); }
.sp-btn-del { width: 22px; height: 22px; border-radius: 50%; border: none; background: transparent; color: var(--color-text-muted, #71717a); cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; }
.sp-btn-del:hover { background: rgba(239,68,68,.15); color: #ef4444; }
.sp-del-confirm { position: absolute; right: 8px; top: 8px; background: var(--color-bg3, #3f3f46); border: 1px solid #ef4444; border-radius: 8px; padding: 6px 10px; display: flex; align-items: center; gap: 6px; font-size: 12px; z-index: 2; }
.sp-del-confirm span { color: #f4f4f5; }
.sp-btn-confirm-yes { padding: 2px 8px; border-radius: 4px; border: none; background: #ef4444; color: white; font-size: 11px; cursor: pointer; }
.sp-btn-confirm-no { padding: 2px 8px; border-radius: 4px; border: 1px solid var(--color-border, #3f3f46); background: transparent; color: var(--color-text-muted, #a1a1aa); font-size: 11px; cursor: pointer; }
.sp-footer { padding: 8px 16px; border-top: 1px solid var(--color-border, #3f3f46); }
.sp-hint { font-size: 11px; color: var(--color-text-muted, #71717a); }
</style>
