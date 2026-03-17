<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTabStore } from '@/stores/tabs'
import { listRecentSessions } from '@/api'
import { open } from '@tauri-apps/plugin-dialog'
import type { Session, SessionKind } from '@/types'

const router = useRouter()
const tabStore = useTabStore()
const sessions = ref<Session[]>([])

onMounted(async () => {
  try { sessions.value = await listRecentSessions(10) } catch {}
})

const views = [
  { kind: 'text_diff' as SessionKind,   icon: '📄', label: 'Text Compare',   desc: '文本文件并排对比与三路合并' },
  { kind: 'folder_diff' as SessionKind, icon: '📁', label: 'Folder Compare', desc: '文件夹差异、同步、合并' },
  { kind: 'table_diff' as SessionKind,  icon: '📊', label: 'Table Compare',  desc: 'CSV / Excel 表格对比' },
  { kind: 'hex_diff' as SessionKind,    icon: '🔢', label: 'Hex Compare',    desc: '二进制文件 HexDump 对比' },
  { kind: 'image_diff' as SessionKind,  icon: '🖼️', label: 'Image Compare',  desc: '像素级图片差异分析' },
]

async function startNewDiff(kind: SessionKind) {
  const isFolder = kind === 'folder_diff'
  const left = await open({ multiple: false, directory: isFolder, title: 'Select Left' })
  if (!left) return
  const right = await open({ multiple: false, directory: isFolder, title: 'Select Right' })
  if (!right) return
  tabStore.openNewDiff(kind, left as string, right as string)
  router.push(tabStore.KIND_ROUTE[kind])
}

function kindLabel(kind: SessionKind) {
  return views.find(v => v.kind === kind)?.label ?? kind
}
function kindIcon(kind: SessionKind) {
  return views.find(v => v.kind === kind)?.icon ?? '📄'
}
function fmtDate(dt: string) {
  return new Date(dt).toLocaleString()
}
</script>

<template>
  <div class="home-view">
    <!-- Hero -->
    <div class="home-hero">
      <h1>⚡ OpenDiff</h1>
      <p>Beyond Compare 1:1 开源复刻 — Vue 3 + Tauri 2 + Rust</p>
    </div>

    <div class="home-body">
      <!-- New comparison -->
      <section>
        <h2 class="section-title">新建对比</h2>
        <div class="view-grid">
          <button
            v-for="v in views"
            :key="v.kind"
            class="view-card"
            @click="startNewDiff(v.kind)"
          >
            <span class="view-icon">{{ v.icon }}</span>
            <span class="view-label">{{ v.label }}</span>
            <span class="view-desc">{{ v.desc }}</span>
          </button>
        </div>
      </section>

      <!-- Recent sessions -->
      <section v-if="sessions.length">
        <h2 class="section-title">最近会话</h2>
        <div class="session-list">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            @click="tabStore.openNewDiff(s.kind, s.left_path, s.right_path); router.push(tabStore.KIND_ROUTE[s.kind])"
          >
            <span class="session-icon">{{ kindIcon(s.kind) }}</span>
            <div class="session-info flex-1 overflow-hidden">
              <div class="session-name truncate bold">{{ s.name }}</div>
              <div class="session-paths truncate text-muted text-sm">
                {{ s.left_path }} ↔ {{ s.right_path }}
              </div>
            </div>
            <span class="session-time text-muted text-xs">{{ fmtDate(s.last_opened ?? s.updated_at) }}</span>
          </div>
        </div>
      </section>

      <!-- Empty state -->
      <section v-else class="empty-state">
        <p class="text-muted">还没有对比记录，从上方选择一种对比视图开始！</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-view {
  height: 100%; overflow-y: auto;
  background: var(--color-bg);
}
.home-hero {
  background: linear-gradient(135deg, var(--color-bg3) 0%, var(--color-bg) 100%);
  border-bottom: 1px solid var(--color-border);
  padding: 48px 48px 32px;
}
.home-hero h1 {
  font-size: 32px; font-weight: 800; color: var(--color-accent);
  margin-bottom: 8px; letter-spacing: -1px;
}
.home-hero p { color: var(--color-text-muted); font-size: 14px; }

.home-body { padding: 32px 48px; max-width: 960px; display: flex; flex-direction: column; gap: 32px; }

.section-title {
  font-size: 13px; font-weight: 700; color: var(--color-text-muted);
  text-transform: uppercase; letter-spacing: .08em;
  margin-bottom: 12px; padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.view-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;
}
.view-card {
  display: flex; flex-direction: column; align-items: flex-start;
  gap: 6px; padding: 16px;
  background: var(--color-bg2); border: 1px solid var(--color-border);
  border-radius: var(--radius-lg); cursor: pointer; text-align: left;
  transition: all var(--transition);
}
.view-card:hover {
  border-color: var(--color-accent); background: var(--color-surface);
  transform: translateY(-2px);
}
.view-icon { font-size: 28px; }
.view-label { font-weight: 700; font-size: 13px; }
.view-desc { font-size: 11px; color: var(--color-text-muted); line-height: 1.4; }

.session-list { display: flex; flex-direction: column; gap: 4px; }
.session-item {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px; border-radius: var(--radius);
  background: var(--color-bg2); border: 1px solid var(--color-border);
  cursor: pointer; transition: all var(--transition);
}
.session-item:hover { border-color: var(--color-accent); background: var(--color-surface); }
.session-icon { font-size: 18px; flex-shrink: 0; }
.session-name { font-size: 13px; }
.session-paths { font-size: 11px; }
.session-time { flex-shrink: 0; font-size: 11px; }
.empty-state { padding: 24px; text-align: center; }
</style>
