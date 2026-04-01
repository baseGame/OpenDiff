<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTabStore } from '@/stores/tabs'
import { listRecentSessions, deleteSession, saveSession } from '@/api'
import type { Session, SessionKind } from '@/types'
import { ArrowLeft, FileText, FolderTree, Table, Binary, Image, Play, Trash2, Clock } from 'lucide-vue-next'

const router = useRouter()
const tabStore = useTabStore()

const sessions = ref<Session[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const deleting = ref<string | null>(null)
const confirmDelete = ref<string | null>(null)

function kindIcon(kind: SessionKind) {
  const map: Record<string, any> = {
    text_diff: FileText, folder_diff: FolderTree, table_diff: Table,
    hex_diff: Binary, image_diff: Image,
  }
  return map[kind] ?? FileText
}

function kindLabel(kind: SessionKind) {
  const map: Record<string, string> = {
    text_diff: 'diff_kind.text_diff', folder_diff: 'diff_kind.folder_diff',
    table_diff: 'diff_kind.table_diff', hex_diff: 'diff_kind.hex_diff', image_diff: 'diff_kind.image_diff',
  }
  return map[kind] ?? kind
}

function routeFor(kind: SessionKind) {
  return tabStore.KIND_ROUTE[kind] ?? '/'
}

function fmtDate(dt: string) {
  if (!dt) return ''
  const d = new Date(dt)
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'common.just_now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} common.minutes_ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} common.hours_ago`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function truncatePath(p: string, max = 48) {
  if (!p) return '—'
  if (p.length <= max) return p
  return '…/' + p.split('/').slice(-2).join('/')
}

async function loadSessions() {
  loading.value = true
  error.value = null
  try {
    sessions.value = await listRecentSessions(100)
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

async function openSession(s: Session) {
  try {
    await saveSession({
      id: s.id, kind: s.kind, name: truncatePath(s.left_path || s.right_path),
      left_path: s.left_path, right_path: s.right_path,
      config: s.config ?? { algorithm: 'histogram', ignore_whitespace: false, ignore_case: false, ignore_comments: false, extra: null },
      created_at: s.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  } catch {}
  tabStore.openNewDiff(s.kind, s.left_path, s.right_path)
  router.push(routeFor(s.kind))
}

async function confirmAndDelete(s: Session) {
  if (confirmDelete.value === s.id) {
    deleting.value = s.id
    try {
      await deleteSession(s.id)
      sessions.value = sessions.value.filter(x => x.id !== s.id)
    } catch (e: any) {
      error.value = `删除失败: ${e}`
    } finally {
      deleting.value = null
      confirmDelete.value = null
    }
  } else {
    confirmDelete.value = s.id
    setTimeout(() => { if (confirmDelete.value === s.id) confirmDelete.value = null }, 3000)
  }
}

async function clearAllHistory() {
  if (!confirm('确定清空所有历史记录？此操作不可撤销。')) return
  loading.value = true
  try {
    for (const s of sessions.value) {
      await deleteSession(s.id).catch(() => {})
    }
    sessions.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadSessions)
</script>

<template>
  <div class="history-view flex flex-col h-full overflow-hidden">

    <div class="history-header flex items-center gap-3 px-6 py-4 flex-shrink-0">
      <button class="btn-icon" @click="router.push('/')" :title="$t('nav.home')">
        <ArrowLeft :size="18" />
      </button>
      <div>
        <h1 class="title">{{ $t('history.title') }}</h1>
        <p class="subtitle">{{ $t('history.sessions_count', { n: sessions.length }) }}</p>
      </div>
      <div class="flex-1" />
      <button v-if="sessions.length" class="btn-ghost text-xs" @click="clearAllHistory">
        <Trash2 :size="14" /> {{ $t('history.clear_all') }}
      </button>
    </div>

    <div v-if="error" class="error-banner flex items-center gap-2 px-6">
      <span>{{ $t('history.load_error', { error }) }}</span>
      <button class="btn-ghost text-xs" @click="loadSessions">{{ $t('history.retry') }}</button>
    </div>

    <div v-else-if="loading" class="loading-state flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3 text-muted">
        <div class="spinner" />
        <span>{{ $t('common.loading') }}</span>
      </div>
    </div>

    <div v-else-if="!sessions.length" class="empty-state flex-1 flex flex-col items-center justify-center gap-4">
      <Clock :size="48" class="text-muted opacity-30" />
      <div class="text-center">
        <p class="text-muted text-lg mb-1">{{ $t('history.no_history') }}</p>
        <p class="text-muted text-sm">{{ $t('history.no_history_desc') }}</p>
      </div>
      <button class="btn-primary" @click="router.push('/')">{{ $t('history.start_compare') }}</button>
    </div>

    <div v-else class="session-list flex-1 overflow-y-auto px-6 pb-6">
      <div
        v-for="s in sessions"
        :key="s.id"
        class="session-card"
        :class="{ deleting: deleting === s.id }"
      >
        <div class="session-icon">
          <component :is="kindIcon(s.kind)" :size="18" />
        </div>
        <div class="session-info flex-1 min-w-0">
          <div class="session-kind">{{ $t(kindLabel(s.kind)) }}</div>
          <div class="session-paths">
            <span class="path-chip truncate">{{ truncatePath(s.left_path) }}</span>
            <span class="arrow">↔</span>
            <span class="path-chip truncate">{{ truncatePath(s.right_path) }}</span>
          </div>
          <div class="session-meta">
            <Clock :size="11" />
            <span>{{ fmtDate(s.last_opened ?? s.updated_at ?? '') }}</span>
          </div>
        </div>
        <div class="session-actions flex items-center gap-2">
          <button class="btn-icon action-open" :title="$t('history.start_compare')" @click="openSession(s)">
            <Play :size="16" />
          </button>
          <button
            class="btn-icon action-delete"
            :class="{ 'confirm-delete': confirmDelete === s.id }"
            :title="confirmDelete === s.id ? $t('common.confirm_delete') : $t('common.delete')"
            :disabled="deleting === s.id"
            @click="confirmAndDelete(s)"
          >
            <Trash2 :size="15" />
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.history-view { background: var(--color-bg); }
.history-header { border-bottom: 1px solid var(--color-border); background: var(--color-bg2); }
.title { font-size: 16px; font-weight: 700; margin: 0; }
.subtitle { font-size: 12px; color: var(--color-text-muted); margin: 2px 0 0; }
.error-banner { padding: 8px 24px; background: rgba(239,68,68,.1); border-bottom: 1px solid rgba(239,68,68,.2); color: var(--color-red); font-size: 13px; }
.loading-state { color: var(--color-text-muted); }
.spinner { width: 24px; height: 24px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { color: var(--color-text-muted); }
.session-list { display: flex; flex-direction: column; gap: 6px; padding-top: 12px; }
.session-card { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); transition: all 0.15s; }
.session-card:hover { border-color: var(--color-accent); background: var(--color-bg2); }
.session-card.deleting { opacity: 0.5; pointer-events: none; }
.session-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--color-bg3); color: var(--color-accent); }
.session-info { min-width: 0; }
.session-kind { font-size: 11px; font-weight: 600; color: var(--color-text-muted); margin-bottom: 4px; }
.session-paths { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 12px; }
.path-chip { background: var(--color-bg3); border: 1px solid var(--color-border); border-radius: 4px; padding: 1px 6px; max-width: 180px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.arrow { color: var(--color-text-muted); flex-shrink: 0; }
.session-meta { display: flex; align-items: center; gap: 4px; margin-top: 4px; font-size: 11px; color: var(--color-text-muted); }
.session-actions { gap: 4px; flex-shrink: 0; }
.btn-icon { width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); background: transparent; cursor: pointer; color: var(--color-text-muted); transition: all 0.15s; }
.btn-icon:hover { border-color: var(--color-accent); color: var(--color-accent); }
.action-open:hover { border-color: var(--color-green); color: var(--color-green); }
.action-delete:hover { border-color: var(--color-red); color: var(--color-red); }
.confirm-delete { border-color: var(--color-red) !important; color: var(--color-red) !important; background: rgba(239,68,68,.08); }
.btn-ghost { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; font-size: 12px; }
.btn-ghost:hover { border-color: var(--color-red); color: var(--color-red); }
.btn-primary { padding: 7px 16px; border-radius: 8px; border: none; background: var(--color-accent); color: white; cursor: pointer; font-size: 13px; font-weight: 500; }
.btn-primary:hover { opacity: 0.9; }
</style>
