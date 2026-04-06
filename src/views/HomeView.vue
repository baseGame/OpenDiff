<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTabStore } from '@/stores/tabs'
import { listRecentSessions } from '@/api'
import { open } from '@tauri-apps/plugin-dialog'
import type { Session, SessionKind } from '@/types'
import { 
  FileText, FolderTree, Table, Binary, Image,
  RefreshCw, MoreVertical, Play, Bookmark, BookmarkCheck, ArrowRight, Folder
} from 'lucide-vue-next'

const router = useRouter()
const tabStore = useTabStore()
const sessions = ref<Session[]>([])
const updateAvailable = ref('')
const updateUrl = ref('')

async function checkUpdate() {
  try {
    const r = await fetch('https://api.github.com/repos/baseGame/OpenDiff/releases/latest', {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    if (!r.ok) return
    const data = await r.json() as { tag_name: string; html_url: string; body: string }
    const latest = data.tag_name?.replace(/^v/, '') || ''
    const current = '0.2.11'
    const [lm, lr] = latest.split('.').map(Number)
    const [cm, cr] = current.split('.').map(Number)
    if ((lm ?? 0) > (cm ?? 0) || ((lm ?? 0) === (cm ?? 0) && (lr ?? 0) > (cr ?? 0))) {
      updateAvailable.value = latest
      updateUrl.value = data.html_url
    }
  } catch {}
}

onMounted(async () => {
  try { sessions.value = await listRecentSessions(10) } catch {}
  checkUpdate()
})

// ── Bookmark state ───────────────────────────────────────────────────
const bookmarked = ref<Set<string>>(new Set(
  JSON.parse(localStorage.getItem('opendiff_bookmarks') || '[]')
))
function toggleBookmark(s: Session, e: Event) {
  e.stopPropagation()
  if (bookmarked.value.has(s.id)) {
    bookmarked.value.delete(s.id)
  } else {
    bookmarked.value.add(s.id)
  }
  localStorage.setItem('opendiff_bookmarks', JSON.stringify([...bookmarked.value]))
}

// ── Preset profiles ──────────────────────────────────────────────────
const profiles = [
  { label: 'Backend Sync Rules', kind: 'folder_diff' as SessionKind, desc: 'Compare project directories', icon: FolderTree },
  { label: 'CI/CD Diff Template', kind: 'text_diff' as SessionKind, desc: 'Compare config files', icon: FileText },
  { label: 'Design Assets', kind: 'image_diff' as SessionKind, desc: 'Compare image files', icon: Image },
]
async function openProfile(kind: SessionKind) {
  const isFolder = kind === 'folder_diff'
  const left = await open({ multiple: false, directory: isFolder, title: 'Select Left' })
  if (!left) return
  const right = await open({ multiple: false, directory: isFolder, title: 'Select Right' })
  if (!right) return
  tabStore.openNewDiff(kind, left as string, right as string)
  router.push(tabStore.KIND_ROUTE[kind] || '/')
}

// Adapt to Beyond Compare features
const views = [
  { kind: 'folder_diff' as SessionKind, icon: FolderTree, label: 'Folder Compare', desc: 'Sync directory structures.', theme: 'primary' },
  { kind: 'text_diff' as SessionKind,   icon: FileText,   label: 'Text Compare',   desc: 'Source code diffing.', theme: 'secondary' },
  { kind: 'image_diff' as SessionKind,  icon: Image,      label: 'Image Compare',  desc: 'Pixel-perfect diffs.', theme: 'default' },
  { kind: 'hex_diff' as SessionKind,    icon: Binary,     label: 'Hex Compare',    desc: 'Binary data analysis.', theme: 'default' },
  { kind: 'folder_sync' as SessionKind, icon: RefreshCw,  label: 'Folder Sync',    desc: 'Rule-based sync.', theme: 'sync', isSync: true },
]

// ── Drag & drop global file handler ────────────────────────────────
const isDraggingFiles = ref(false)
let dragCounter2 = 0
function onGlobalDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter2++
  isDraggingFiles.value = true
}
function onGlobalDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter2--
  if (dragCounter2 === 0) isDraggingFiles.value = false
}
function onGlobalDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
async function onGlobalDrop(e: DragEvent) {
  e.preventDefault()
  isDraggingFiles.value = false
  dragCounter2 = 0
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length === 0) return
  // If 2 files dropped → auto start text compare
  if (files.length >= 2) {
    try {
      const [l, r] = await Promise.all([files[0].text(), files[1].text()])
      tabStore.openNewDiff('text_diff', files[0].name, files[1].name)
      // Load content into tab store — store the paths as file names
      // The TextDiffView will read them via the tab store
      router.push('/text-diff')
    } catch {}
  }
}
onMounted(() => {
  window.addEventListener('dragenter', onGlobalDragEnter)
  window.addEventListener('dragleave', onGlobalDragLeave)
  window.addEventListener('dragover', onGlobalDragOver)
  window.addEventListener('drop', onGlobalDrop)
})

async function startNewDiff(kind: SessionKind) {
  // if folder_sync, we just treat it as folder_diff for now or handle it if supported
  const actualKind = kind === 'folder_sync' ? 'folder_diff' : kind
  const isFolder = actualKind === 'folder_diff'
  const left = await open({ multiple: false, directory: isFolder, title: 'Select Left' })
  if (!left) return
  const right = await open({ multiple: false, directory: isFolder, title: 'Select Right' })
  if (!right) return
  tabStore.openNewDiff(actualKind, left as string, right as string)
  router.push(tabStore.KIND_ROUTE[actualKind] || '/')
}

function kindIcon(kind: SessionKind) {
  return views.find(v => v.kind === kind)?.icon ?? FileText
}

function kindTheme(kind: SessionKind) {
  return views.find(v => v.kind === kind)?.theme ?? 'default'
}

function fmtDate(dt: string) {
  return new Date(dt).toLocaleString()
}
</script>

<template>
  <div class="home-view"
    @dragenter="onGlobalDragEnter" @dragleave="onGlobalDragLeave"
    @dragover="onGlobalDragOver" @drop="onGlobalDrop"
  >
    <!-- Update banner -->
    <a v-if="updateAvailable" :href="updateUrl" target="_blank" class="update-banner">
      🆕 New version {{ updateAvailable }} available — click to download
    </a>

    <!-- Global drag overlay -->
    <div v-if="isDraggingFiles" class="home-drag-overlay">
      <div class="drag-welcome-box">
        <div class="drag-welcome-icon">📂</div>
        <div class="drag-welcome-title">Drop files to compare</div>
        <div class="drag-welcome-sub">2 files → Text Compare · 1 file → open first pane</div>
      </div>
    </div>

    <main class="home-main">
      <header class="home-header">
        <div class="header-subtitle">
          <span class="header-line"></span>
          Precision Session Manager
        </div>
        <h1 class="header-title">Start New Comparison</h1>
      </header>

      <section class="view-grid">
        <button
          v-for="v in views"
          :key="v.kind"
          class="view-card"
          :class="['theme-' + v.theme]"
          @click="startNewDiff(v.kind)"
        >
          <div class="view-icon-wrapper">
            <component :is="v.icon" :size="16" />
          </div>
          <div class="view-text">
            <h3 class="view-label">{{ v.label }}</h3>
            <p class="view-desc">{{ v.desc }}</p>
          </div>
        </button>
      </section>

      <section class="sessions-section">
        <div class="sessions-header">
          <h2 class="section-title">{{ $t('home.recent_sessions') }}</h2>
          <button class="view-all-btn" @click="router.push('/history')">{{ $t('home.view_all_history') }}</button>
        </div>
        
        <div class="session-list" v-if="sessions.length">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="session-item"
            @click="tabStore.openNewDiff(s.kind, s.left_path, s.right_path); router.push(tabStore.KIND_ROUTE[s.kind] || '/')"
          >
            <div class="session-content">
              <div class="session-icon-wrapper" :class="['theme-' + kindTheme(s.kind)]">
                <component :is="kindIcon(s.kind)" :size="16" />
              </div>
              <div class="session-info">
                <div class="session-paths">
                  <span class="path-text">{{ s.left_path }}</span>
                  <ArrowRight :size="12" class="path-arrow" />
                  <span class="path-text">{{ s.right_path }}</span>
                </div>
                <p class="session-meta">Analyzed {{ fmtDate(s.last_opened ?? s.updated_at) }}</p>
              </div>
            </div>
            <div class="session-actions">
              <button class="action-btn btn-bookmark" :class="{ bookmarked: bookmarked.has(s.id) }" @click="toggleBookmark(s, $event)">
                <BookmarkCheck v-if="bookmarked.has(s.id)" :size="16" />
                <Bookmark v-else :size="16" />
              </button>
              <button class="action-btn btn-play" @click.stop="startNewDiff(s.kind)"><Play :size="16" /></button>
            </div>
          </div>
        </div>
        
        <!-- Empty state -->
        <div v-else class="empty-state">
          <Folder :size="32" class="empty-icon" />
          <p>No recent sessions found.</p>
        </div>
      </section>
    </main>

    <aside class="home-aside">
      <div class="aside-section">
        <h2 class="section-title">{{ $t('home.workspace_status') }}</h2>
        <div class="status-card">
          <div class="status-header">
            <span>Disk Usage</span>
            <span>1.2 GB / 10 GB</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>
      </div>

      <div class="aside-section">
        <h2 class="section-title">{{ $t('home.saved_profiles') }}</h2>
        <div class="profile-list">
          <button v-for="p in profiles" :key="p.label" class="profile-item" @click="openProfile(p.kind)" :title="p.desc">
            <div class="profile-info">
              <component :is="p.icon" :size="13" class="profile-icon" />
              <span>{{ p.label }}</span>
            </div>
            <MoreVertical :size="14" class="profile-more" />
          </button>
        </div>
      </div>

      <div class="tip-card" id="tip-card">
        <p><strong>Tip:</strong> Drag and drop any two files or folders directly into the main grid to start a comparison instantly.</p>
        <button class="tip-close" @click="$el.parentElement.remove()" title="Dismiss">×</button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.home-view {
  display: flex;
  height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  overflow: hidden;
  
  /* Semantic color mapping based on design */
  --surface-container-low: var(--color-bg2);
  --surface-container-highest: var(--color-bg3);
  --surface-container-lowest: var(--color-surface);
  
  --primary: var(--color-accent);
  --primary-container: rgba(37, 99, 235, 0.15);
  --on-primary-container: var(--color-accent);
  
  --secondary: var(--color-green);
  --secondary-container: rgba(22, 163, 74, 0.15);
  --on-secondary-container: var(--color-green);

  --tertiary: var(--color-red);
  --tertiary-container: rgba(220, 38, 38, 0.15);
  --on-tertiary-container: var(--color-red);
  
  --on-surface: var(--color-text);
  --on-surface-variant: var(--color-text-muted);
  --outline-variant: var(--color-border);
}

.home-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 32px 48px;
  gap: 32px;
  overflow-y: auto;
}

.home-aside {
  width: 256px;
  background: var(--surface-container-low);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 32px;
  flex-shrink: 0;
  border-left: 1px solid var(--outline-variant);
}

/* Header */
.home-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.header-subtitle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.header-line {
  width: 24px;
  height: 1px;
  background: var(--primary);
}

.header-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--on-surface);
  margin: 0;
}

/* View Grid */
.view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
  flex-shrink: 0;
}

.view-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 12px;
  background: var(--surface-container-low);
  border-radius: var(--radius);
  border: none;
  cursor: pointer;
  transition: all var(--transition);
  text-align: left;
}

.view-card:hover {
  background: var(--surface-container-highest);
}

.view-icon-wrapper {
  margin-bottom: 8px;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-text {
  display: flex;
  flex-direction: column;
}

.view-label {
  font-size: 12px;
  font-weight: 700;
  margin: 0;
  color: var(--on-surface);
}

.view-desc {
  font-size: 10px;
  color: var(--on-surface-variant);
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Theme Classes */
.theme-primary .view-icon-wrapper {
  background: var(--primary-container);
  color: var(--on-primary-container);
}

.theme-secondary .view-icon-wrapper {
  background: var(--secondary-container);
  color: var(--on-secondary-container);
}

.theme-default .view-icon-wrapper {
  background: var(--surface-container-highest);
  color: var(--primary);
}

.theme-sync {
  background: var(--primary) !important;
  color: #ffffff !important;
}

.theme-sync:hover {
  background: var(--color-accent-hover) !important;
}

.theme-sync .view-icon-wrapper {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.theme-sync .view-label {
  color: #ffffff;
}

.theme-sync .view-desc {
  color: rgba(255, 255, 255, 0.7);
}

/* Sessions Section */
.sessions-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sessions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--on-surface-variant);
  margin: 0;
}

.view-all-btn {
  font-size: 10px;
  font-weight: 500;
  color: var(--primary);
  background: none;
  border: none;
  cursor: pointer;
}

.view-all-btn:hover {
  text-decoration: underline;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: var(--surface-container-lowest);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--transition);
}

.session-item:hover {
  border-color: rgba(0, 0, 0, 0.05); /* Outline variant equivalent */
  background: var(--surface-container-low);
}

.session-content {
  display: flex;
  align-items: center;
  gap: 16px;
  overflow: hidden;
}

.session-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: var(--surface-container-highest);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.session-icon-wrapper.theme-primary { color: var(--primary); }
.session-icon-wrapper.theme-secondary { color: var(--secondary); }
.session-icon-wrapper.theme-default { color: var(--on-surface-variant); }
.session-icon-wrapper.theme-sync { color: var(--primary); }

.session-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.session-paths {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.path-text {
  color: var(--on-surface);
}

.path-arrow {
  color: var(--outline-variant);
  flex-shrink: 0;
}

.session-meta {
  font-size: 10px;
  color: var(--on-surface-variant);
  margin: 4px 0 0 0;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition: opacity var(--transition);
}

.session-item:hover .session-actions {
  opacity: 1;
}

.action-btn {
  padding: 6px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition);
}

.btn-bookmark {
  color: var(--on-surface-variant);
}

.btn-bookmark:hover {
  background: var(--surface-container-highest);
}

.btn-bookmark.bookmarked {
  color: var(--color-yellow, #f59e0b);
}

.profile-list { display: flex; flex-direction: column; gap: 2px; }
.profile-item {
  width: 100%; text-align: left; padding: 7px 8px;
  border-radius: var(--radius-sm); background: transparent; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: space-between;
  transition: background 0.15s; font-size: 12px; color: var(--on-surface);
}
.profile-item:hover { background: var(--surface-container-highest); }
.profile-item:hover .profile-more { opacity: 1; }
.profile-info { display: flex; align-items: center; gap: 7px; }
.profile-icon { color: var(--color-text-muted); flex-shrink: 0; }
.profile-more { color: var(--outline-variant); opacity: 0; transition: opacity 0.15s; }
.tip-card { position: relative; }
.tip-close {
  position: absolute; top: 4px; right: 8px;
  background: none; border: none; color: inherit; cursor: pointer;
  font-size: 16px; line-height: 1; opacity: 0.5; padding: 0 4px;
}
.tip-close:hover { opacity: 1; }

.btn-play {
  color: var(--primary);
}

.btn-play:hover {
  background: var(--primary-container);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--on-surface-variant);
  background: var(--surface-container-lowest);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--outline-variant);
}

.empty-icon {
  margin-bottom: 12px;
  opacity: 0.5;
}

/* Aside Elements */
.aside-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-card {
  background: var(--surface-container-lowest);
  border-radius: var(--radius);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-header {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--on-surface-variant);
}

.status-header span:last-child {
  color: var(--on-surface);
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: var(--surface-container-highest);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  width: 12%;
}

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.profile-item {
  width: 100%;
  text-align: left;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all var(--transition);
}

.profile-item:hover {
  background: var(--surface-container-highest);
}

.profile-item span {
  font-size: 11px;
  font-weight: 500;
  color: var(--on-surface);
}

.profile-more {
  color: var(--outline-variant);
  opacity: 0;
  transition: opacity var(--transition);
}

.profile-item:hover .profile-more {
  opacity: 1;
}

.tip-card {
  padding: 12px;
  border-radius: var(--radius);
  background: var(--primary-container);
  border: 1px solid rgba(37, 99, 235, 0.1);
  margin-top: auto;
}

.tip-card p {
  font-size: 10px;
  color: var(--primary);
  line-height: 1.5;
  margin: 0;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .home-aside {
    display: none;
  }
}
.update-banner { display:block; padding:8px 16px; background:linear-gradient(90deg,rgba(59,130,246,.15),rgba(16,185,129,.15)); border-bottom:1px solid rgba(59,130,246,.3); color:var(--color-accent); font-size:12px; text-decoration:none; text-align:center; }
.update-banner:hover { background:linear-gradient(90deg,rgba(59,130,246,.25),rgba(16,185,129,.25)); }
</style>

/* Drag overlay */
.home-drag-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(15,15,25,0.88);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.drag-welcome-box {
  border: 2px dashed var(--color-accent);
  border-radius: 20px;
  padding: 48px 72px;
  text-align: center;
  background: rgba(59,130,246,0.06);
}
.drag-welcome-icon { font-size: 56px; margin-bottom: 16px; }
.drag-welcome-title { font-size: 22px; font-weight: 700; color: var(--color-accent); margin-bottom: 10px; }
.drag-welcome-sub { font-size: 14px; color: var(--color-text-muted); }
