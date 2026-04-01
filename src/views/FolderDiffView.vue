<script setup lang="ts">
/**
 * FolderDiffView — Phase 3: Full Folder Sync Engine
 * 5 sync modes: Update Left / Right / Both / Mirror to Left / Right
 * Live preview + one-click execute
 */
import { ref, computed, onMounted } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { listDir, copyFile, deletePath, diffFolders, saveSession } from '@/api'
import type { FolderDiffResult } from '@/types'
import { open } from '@tauri-apps/plugin-dialog'
import { useRouter } from 'vue-router'

const router = useRouter()
const tabStore = useTabStore()
const activeTab = computed(() => tabStore.activeTab)

// ── Paths ─────────────────────────────────────────────────────────────
const leftRoot  = ref('')
const rightRoot = ref('')

// ── Tree state ────────────────────────────────────────────────────────
const leftTree  = ref<TreeNode[]>([])
const rightTree = ref<TreeNode[]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)

// ── Filter ───────────────────────────────────────────────────────────
type FilterMode = 'all' | 'diffs' | 'same' | 'left-only' | 'right-only'
const filterMode = ref<FilterMode>('all')
const excludeGlob = ref('')

// ── Compare mode ──────────────────────────────────────────────────────
type CompareMode = 'time' | 'size' | 'crc'
const compareMode = ref<CompareMode>('time')

// ── Sync state ────────────────────────────────────────────────────────
type SyncMode = 'update-left' | 'update-right' | 'update-both' | 'mirror-left' | 'mirror-right'
const syncMode = ref<SyncMode>('update-right')
const showSyncPanel = ref(false)
const syncPreview = ref<SyncAction[]>([])
const syncLog    = ref<SyncLogEntry[]>([])
const syncRunning = ref(false)
const syncProgress = ref(0)
const syncTotal   = ref(0)

interface SyncAction {
  action: 'copy' | 'delete'
  direction: 'left' | 'right'
  path: string       // relative path
  leftPath: string   // full left path
  rightPath: string  // full right path
  size?: number
  modified?: number
  status: 'pending' | 'done' | 'error'
  errorMsg?: string
}

interface SyncLogEntry {
  time: string
  msg: string
  type: 'info' | 'success' | 'error'
}

interface TreeNode {
  name: string; path: string; kind: 'file' | 'directory'
  size?: number; modified?: number
  diffStatus: 'same' | 'modified' | 'left-only' | 'right-only' | 'unknown'
  children?: TreeNode[]; expanded: boolean; paired?: TreeNode
}

// ── Load folders ──────────────────────────────────────────────────────
async function pickFolder(side: 'left' | 'right') {
  const path = await open({ multiple: false, directory: true, title: `Select ${side} folder` }) as string | null
  if (!path) return
  if (side === 'left') leftRoot.value = path
  else rightRoot.value = path
  if (leftRoot.value && rightRoot.value) await loadAndCompare()
}

async function loadAndCompare() {
  loading.value = true; error.value = null
  try {
    let rustResult: FolderDiffResult | null = null
    try {
      rustResult = await diffFolders(leftRoot.value, rightRoot.value, {
        ignorePatterns: excludeGlob.value ? excludeGlob.value.split(';').map(s => s.trim()).filter(Boolean) : [],
        compareContent: compareMode.value === 'crc',
        compareTime: compareMode.value === 'time',
        compareSize: compareMode.value === 'size',
      } as any)
    } catch (_) { /* noop */ }

    const [leftEntries, rightEntries] = await Promise.all([
      listDir(leftRoot.value), listDir(rightRoot.value),
    ])
    leftTree.value  = await buildTree(leftEntries, leftRoot.value)
    rightTree.value = await buildTree(rightEntries, rightRoot.value)
    if (rustResult) applyRustResult(rustResult)
    else pairAndCompare(leftTree.value, rightTree.value)

    if (leftRoot.value || rightRoot.value) {
      saveSession({
        id: `s_${Date.now()}`, kind: 'folder_diff',
        name: leftRoot.value || rightRoot.value || 'Folder Compare',
        left_path: leftRoot.value, right_path: rightRoot.value,
        config: { algorithm: 'histogram', ignore_whitespace: false, ignore_case: false, ignore_comments: false, extra: null },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).catch(() => {})
    }
  } catch (e: any) { error.value = String(e) }
  finally { loading.value = false }
}

async function buildTree(entries: any[], root: string): Promise<TreeNode[]> {
  return entries.map(e => ({
    name: e.name,
    path: e.path['0'] ?? `${root}/${e.name}`,
    kind: e.kind === 'directory' ? 'directory' : 'file',
    size: e.metadata.size, modified: e.metadata.modified,
    diffStatus: 'unknown' as const,
    children: undefined, expanded: false, paired: undefined,
  }))
}

function applyRustResult(result: FolderDiffResult) {
  const m = new Map<string, any>()
  for (const e of result.entries ?? []) m.set(e.rel_path, e)
  function apply(nodes: TreeNode[]) {
    for (const n of nodes) {
      const ent = m.get(n.name)
      if (ent) {
        if (ent.left_status === 'LeftOnly') n.diffStatus = 'left-only'
        else if (ent.right_status === 'RightOnly') n.diffStatus = 'right-only'
        else if (ent.left_status === 'Modified' || ent.right_status === 'Modified') n.diffStatus = 'modified'
        else n.diffStatus = 'same'
      }
      if (n.children) apply(n.children)
    }
  }
  apply(leftTree.value); apply(rightTree.value)
}

function pairAndCompare(left: TreeNode[], right: TreeNode[]) {
  const rm = new Map(right.map(n => [n.name, n]))
  const lm = new Map(left.map(n => [n.name, n]))
  for (const ln of left) {
    const rn = rm.get(ln.name)
    if (!rn) { ln.diffStatus = 'left-only' }
    else { ln.paired = rn; rn.paired = ln; ln.diffStatus = rn.diffStatus = compareNodes(ln, rn) }
  }
  for (const rn of right) {
    if (!lm.has(rn.name) && rn.diffStatus === 'unknown') rn.diffStatus = 'right-only'
  }
}

function compareNodes(a: TreeNode, b: TreeNode): 'same' | 'modified' | 'unknown' {
  if (a.kind !== b.kind) return 'modified'
  if (a.kind === 'directory') return 'same'
  if (compareMode.value === 'crc') return 'same' // placeholder
  if (compareMode.value === 'size') return a.size === b.size ? 'same' : 'modified'
  if (!a.modified || !b.modified) return 'unknown'
  const diff = Math.abs(a.modified - b.modified)
  return diff < 2000 ? 'same' : 'modified'
}

// ── Flattened nodes for table ─────────────────────────────────────────
interface FlatNode {
  left?: TreeNode; right?: TreeNode; depth: number; isDir: boolean
}
const allNodes = computed((): FlatNode[] => {
  const result: FlatNode[] = []
  function flatten(nodes: TreeNode[], depth = 0) {
    for (const n of nodes) {
      if (n.diffStatus === 'same' && filterMode.value === 'diffs') continue
      if (n.diffStatus === 'left-only' && filterMode.value !== 'all' && filterMode.value !== 'left-only') continue
      if (n.diffStatus === 'right-only' && filterMode.value !== 'all' && filterMode.value !== 'right-only') continue
      if (n.diffStatus === 'modified' && filterMode.value === 'same') continue
      result.push({ left: n, right: n.paired, depth, isDir: n.kind === 'directory' })
      if (n.expanded && n.children) flatten(n.children, depth + 1)
    }
  }
  // interleave left and right matching entries
  const lm = new Map(leftTree.value.map(n => [n.name, n]))
  for (const ln of leftTree.value) {
    if (ln.diffStatus === 'same' && filterMode.value === 'diffs') continue
    if (ln.diffStatus === 'left-only' && filterMode.value !== 'all' && filterMode.value !== 'left-only') continue
    if (ln.diffStatus === 'modified' && filterMode.value === 'same') continue
    const rn = ln.paired
    result.push({ left: ln, right: rn, depth: 0, isDir: ln.kind === 'directory' })
    if (ln.expanded && ln.children) flatten(ln.children, 1)
  }
  // right-only nodes not in left
  const seen = new Set(leftTree.value.map(n => n.name))
  for (const rn of rightTree.value) {
    if (rn.diffStatus === 'right-only') {
      if (filterMode.value === 'all' || filterMode.value === 'right-only') {
        result.push({ left: undefined, right: rn, depth: 0, isDir: rn.kind === 'directory' })
      }
    }
  }
  return result
})

function flatten(nodes: TreeNode[], depth: number): FlatNode[] {
  const r: FlatNode[] = []
  for (const n of nodes) {
    if (n.diffStatus === 'same' && filterMode.value === 'diffs') continue
    if (n.diffStatus === 'left-only' && filterMode.value !== 'all' && filterMode.value !== 'left-only') continue
    if (n.diffStatus === 'right-only' && filterMode.value !== 'all' && filterMode.value !== 'right-only') continue
    if (n.diffStatus === 'modified' && filterMode.value === 'same') continue
    r.push({ left: n, right: n.paired, depth, isDir: n.kind === 'directory' })
    if (n.expanded && n.children) r.push(...flatten(n.children, depth + 1))
  }
  return r
}

// ── Stats ─────────────────────────────────────────────────────────────
const folderStats = computed(() => {
  let same = 0, modified = 0, lo = 0, ro = 0, total = 0
  function count(nodes: TreeNode[]) {
    for (const n of nodes) {
      if (n.kind === 'file') {
        total++
        if (n.diffStatus === 'same') same++
        else if (n.diffStatus === 'modified') modified++
        else if (n.diffStatus === 'left-only') lo++
        else if (n.diffStatus === 'right-only') ro++
      }
      if (n.children) count(n.children)
    }
  }
  count(leftTree.value)
  return { same, modified, 'left-only': lo, 'right-only': ro, total }
})

// ── Sync computation ─────────────────────────────────────────────────
const syncModeOptions = [
  { value: 'update-right', label: '→ Update Right',  desc: 'Copy newer + orphans from Left to Right', icon: '→' },
  { value: 'update-left',  label: '← Update Left',   desc: 'Copy newer + orphans from Right to Left', icon: '←' },
  { value: 'update-both',   label: '↔ Update Both',  desc: 'Copy newer files to the other side',    icon: '↔' },
  { value: 'mirror-right',  label: '⇉ Mirror Right', desc: 'Make Right identical to Left (incl. deletions)', icon: '⇉' },
  { value: 'mirror-left',   label: '⇇ Mirror Left',   desc: 'Make Left identical to Right (incl. deletions)', icon: '⇇' },
]

function computeSyncPreview() {
  syncPreview.value = []
  for (const node of allNodes.value) {
    if (node.isDir || !node.left || !node.right) continue
    const st = node.left.diffStatus
    const lm = node.left.modified ?? 0
    const rm = node.right?.modified ?? 0
    const ls = node.left.size ?? 0
    const rs = node.right?.size ?? 0

    if (syncMode.value === 'update-right') {
      // newer on left → copy left to right; orphan left → copy
      if (st === 'left-only') {
        syncPreview.value.push({ action: 'copy', direction: 'right', path: node.left.name, leftPath: node.left.path, rightPath: `${rightRoot.value}/${node.left.name}`, size: ls, modified: lm, status: 'pending' })
      } else if (st === 'modified' && lm > rm) {
        syncPreview.value.push({ action: 'copy', direction: 'right', path: node.left.name, leftPath: node.left.path, rightPath: `${rightRoot.value}/${node.left.name}`, size: ls, modified: lm, status: 'pending' })
      }
    } else if (syncMode.value === 'update-left') {
      if (st === 'right-only' && node.right) {
        syncPreview.value.push({ action: 'copy', direction: 'left', path: node.right.name, leftPath: `${leftRoot.value}/${node.right.name}`, rightPath: node.right.path, size: rs, modified: rm, status: 'pending' })
      } else if (st === 'modified' && rm > lm && node.right) {
        syncPreview.value.push({ action: 'copy', direction: 'left', path: node.right.name, leftPath: `${leftRoot.value}/${node.right.name}`, rightPath: node.right.path, size: rs, modified: rm, status: 'pending' })
      }
    } else if (syncMode.value === 'update-both') {
      if (st === 'modified') {
        if (lm > rm) syncPreview.value.push({ action: 'copy', direction: 'right', path: node.left.name, leftPath: node.left.path, rightPath: `${rightRoot.value}/${node.left.name}`, size: ls, modified: lm, status: 'pending' })
        if (rm > lm && node.right) syncPreview.value.push({ action: 'copy', direction: 'left', path: node.right.name, leftPath: `${leftRoot.value}/${node.right.name}`, rightPath: node.right.path, size: rs, modified: rm, status: 'pending' })
      }
    } else if (syncMode.value === 'mirror-right') {
      if (st === 'left-only') {
        syncPreview.value.push({ action: 'copy', direction: 'right', path: node.left.name, leftPath: node.left.path, rightPath: `${rightRoot.value}/${node.left.name}`, size: ls, modified: lm, status: 'pending' })
      } else if (st === 'modified') {
        syncPreview.value.push({ action: 'copy', direction: 'right', path: node.left.name, leftPath: node.left.path, rightPath: `${rightRoot.value}/${node.left.name}`, size: ls, modified: lm, status: 'pending' })
      }
      // right-only files → delete from right
      if (st === 'right-only' && node.right) {
        syncPreview.value.push({ action: 'delete', direction: 'right', path: node.right.name, leftPath: '', rightPath: node.right.path, size: rs, modified: rm, status: 'pending' })
      }
    } else if (syncMode.value === 'mirror-left') {
      if (st === 'right-only' && node.right) {
        syncPreview.value.push({ action: 'copy', direction: 'left', path: node.right.name, leftPath: `${leftRoot.value}/${node.right.name}`, rightPath: node.right.path, size: rs, modified: rm, status: 'pending' })
      } else if (st === 'modified' && node.right) {
        syncPreview.value.push({ action: 'copy', direction: 'left', path: node.right.name, leftPath: `${leftRoot.value}/${node.right.name}`, rightPath: node.right.path, size: rs, modified: rm, status: 'pending' })
      }
      if (st === 'left-only') {
        syncPreview.value.push({ action: 'delete', direction: 'left', path: node.left.name, leftPath: node.left.path, rightPath: '', size: ls, modified: lm, status: 'pending' })
      }
    }
  }
  // also handle right-only nodes (not paired)
  for (const rn of rightTree.value) {
    if (rn.diffStatus !== 'right-only' || rn.kind !== 'file') continue
    if (syncMode.value === 'update-right') {
      // orphan right → no action for update-right
    } else if (syncMode.value === 'update-left') {
      syncPreview.value.push({ action: 'copy', direction: 'left', path: rn.name, leftPath: `${leftRoot.value}/${rn.name}`, rightPath: rn.path, size: rn.size, modified: rn.modified, status: 'pending' })
    } else if (syncMode.value === 'mirror-right') {
      syncPreview.value.push({ action: 'delete', direction: 'right', path: rn.name, leftPath: '', rightPath: rn.path, size: rn.size, modified: rn.modified, status: 'pending' })
    }
  }
  // left-only in mirror-left
  if (syncMode.value === 'mirror-left') {
    for (const ln of leftTree.value) {
      if (ln.diffStatus === 'left-only' && ln.kind === 'file') {
        syncPreview.value.push({ action: 'delete', direction: 'left', path: ln.name, leftPath: ln.path, rightPath: '', size: ln.size, modified: ln.modified, status: 'pending' })
      }
    }
  }
  showSyncPanel.value = true
  addLog('info', `Preview: ${syncPreview.value.length} action(s) calculated for "${syncModeOptions.find(o => o.value === syncMode.value)?.label}"`)
}

async function executeSync() {
  if (!syncPreview.value.length) return
  syncRunning.value = true
  syncTotal.value = syncPreview.value.length
  syncProgress.value = 0
  addLog('info', `Starting sync: ${syncTotal.value} operation(s)...`)
  for (const action of syncPreview.value) {
    try {
      if (action.action === 'copy') {
        if (action.direction === 'right') {
          await copyFile(action.leftPath, action.rightPath)
        } else {
          await copyFile(action.rightPath, action.leftPath)
        }
        action.status = 'done'
        addLog('success', `✓ Copied: ${action.path}`)
      } else if (action.action === 'delete') {
        if (action.direction === 'right' && action.rightPath) {
          await deletePath(action.rightPath)
        } else if (action.direction === 'left' && action.leftPath) {
          await deletePath(action.leftPath)
        }
        action.status = 'done'
        addLog('success', `✓ Deleted: ${action.path}`)
      }
    } catch (e: any) {
      action.status = 'error'; action.errorMsg = String(e)
      addLog('error', `✗ Failed: ${action.path} — ${e}`)
    }
    syncProgress.value++
  }
  syncRunning.value = false
  addLog('info', `Sync complete! ${syncPreview.value.filter(a => a.status === 'done').length}/${syncTotal.value} succeeded.`)
  // Refresh after sync
  await loadAndCompare()
}

function addLog(type: SyncLogEntry['type'], msg: string) {
  const t = new Date().toLocaleTimeString()
  syncLog.value.unshift({ time: t, msg, type })
  if (syncLog.value.length > 100) syncLog.value.pop()
}

// ── UI helpers ────────────────────────────────────────────────────────
function statusColor(s: string) {
  return { same: '', modified: 'mod', 'left-only': 'lo', 'right-only': 'ro', unknown: '' }[s] ?? ''
}
function fmtSize(b?: number) {
  if (b == null) return ''; if (b < 1024) return `${b}B`; if (b < 1048576) return `${(b/1024).toFixed(1)}K`; return `${(b/1048576).toFixed(1)}M`
}
function fmtTime(ms?: number) {
  if (!ms) return ''; return new Date(ms).toLocaleString()
}
function toggleExpand(n: TreeNode, side: 'left' | 'right') {
  n.expanded = !n.expanded
  if (n.expanded && !n.children?.length) expandNode(n, side)
}
async function expandNode(n: TreeNode, side: 'left' | 'right') {
  try {
    const root = side === 'left' ? leftRoot.value : rightRoot.value
    const entries = await listDir(n.path)
    n.children = await buildTree(entries, root)
    pairAndCompare(n.children, n.children) // self-pair for now
  } catch { /* ignore */ }
}

onMounted(() => {
  if (activeTab.value?.leftPath && activeTab.value?.rightPath) {
    leftRoot.value = activeTab.value.leftPath; rightRoot.value = activeTab.value.rightPath
    loadAndCompare()
  }
})
</script>

<template>
  <div class="fdv">

    <!-- Breadcrumb -->
    <div class="fdv-crumb">
      <button class="crumb-home" @click="router.push('/')">{{ $t('nav.home') }}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb-cur">{{ $t('folder_diff.title') }}</span>
      <template v-if="leftRoot || rightRoot">
        <span class="crumb-sep">›</span>
        <span class="crumb-file">{{ (leftRoot || rightRoot).split('/').pop() }}</span>
        <span class="crumb-sep" v-if="leftRoot && rightRoot">↔</span>
        <span class="crumb-file" v-if="rightRoot">{{ rightRoot.split('/').pop() }}</span>
      </template>
    </div>

    <!-- Toolbar -->
    <div class="fdv-toolbar">
      <button class="fdv-btn-path" @click="pickFolder('left')">
        <span class="fdv-lbl">LEFT</span>
        <span class="fdv-path-txt">{{ leftRoot ? leftRoot.split('/').pop() : $t('folder_diff.select_folder') }}</span>
      </button>
      <button class="fdv-btn" :disabled="loading || !leftRoot || !rightRoot" @click="loadAndCompare">⟳</button>
      <button class="fdv-btn-path" @click="pickFolder('right')">
        <span class="fdv-lbl">RIGHT</span>
        <span class="fdv-path-txt">{{ rightRoot ? rightRoot.split('/').pop() : $t('folder_diff.select_folder') }}</span>
      </button>
      <div class="fdv-sep" />
      <select v-model="compareMode" class="fdv-sel" @change="loadAndCompare">
        <option value="time">{{ $t('folder_diff.by_time') }}</option>
        <option value="size">{{ $t('folder_diff.by_size') }}</option>
        <option value="crc">{{ $t('folder_diff.by_crc') }}</option>
      </select>

      <div class="fdv-sep" />
      <button class="fdv-btn" :class="{ 'fdv-btn-on': showSyncPanel }" @click="computeSyncPreview">
        🔄 {{ $t('folder_sync.sync_preview') || 'Sync' }}
      </button>

      <!-- Sync mode quick select -->
      <select v-model="syncMode" class="fdv-sel">
        <option v-for="o in syncModeOptions" :key="o.value" :value="o.value">{{ o.icon }} {{ o.label }}</option>
      </select>
    </div>

    <!-- Filter bar -->
    <div class="fdv-filter">
      <span class="fdv-filter-lbl">{{ $t('folder_diff.show') }}:</span>
      <button v-for="m in [['all',$t('folder_diff.all')],['diffs',$t('folder_diff.diffs')],['same',$t('folder_diff.same')],['left-only',$t('folder_diff.left_only')],['right-only',$t('folder_diff.right_only')]]" :key="m[0]"
        class="fdv-filter-btn" :class="{ active: filterMode === m[0] }" @click="filterMode = m[0] as FilterMode">
        {{ m[1] }}
      </button>
      <div class="fdv-sep" />
      <input v-model="excludeGlob" class="fdv-input" style="width:160px" :placeholder="$t('folder_diff.exclude')"
        @keydown.enter="loadAndCompare" />
      <div class="fdv-sep" />
      <div v-if="folderStats.total > 0" class="fdv-stats">
        <span class="s-eq">✓ {{ folderStats.same }}</span>
        <span class="s-mod">~ {{ folderStats.modified }}</span>
        <span class="s-lo">← {{ folderStats['left-only'] }}</span>
        <span class="s-ro">{{ folderStats['right-only'] }} →</span>
        <span class="fdv-total">/ {{ folderStats.total }} files</span>
      </div>
    </div>

    <!-- Status -->
    <div v-if="loading" class="fdv-status fdv-ldg"><div class="fdv-spin" /> {{ $t('folder_diff.scanning') }}</div>
    <div v-else-if="error" class="fdv-status fdv-err">⚠ {{ error }}</div>

    <!-- Main table -->
    <div class="fdv-body">
      <table class="fdv-tbl">
        <thead>
          <tr>
            <th class="fdv-th">{{ $t('folder_diff.left') }}</th>
            <th class="fdv-th-sm">Size</th>
            <th class="fdv-th-sm">Modified</th>
            <th class="fdv-th-sm">Status</th>
            <th class="fdv-th-sm"></th>
            <th class="fdv-th">{{ $t('folder_diff.right') }}</th>
            <th class="fdv-th-sm">Size</th>
            <th class="fdv-th-sm">Modified</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in allNodes" :key="i" class="fdv-row" :class="`s-${statusColor(row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown')}`">
            <td class="fdv-td-name" :style="`padding-left:${row.depth * 16 + 8}px`">
              <span v-if="row.isDir" class="fdv-dir-icon" @click="row.left && toggleExpand(row.left, 'left')">
                {{ row.left?.expanded ? '▾' : '▸' }}
              </span>
              <span class="fdv-node-icon">{{ row.isDir ? '📁' : '📄' }}</span>
              {{ row.left?.name ?? row.right?.name ?? '' }}
            </td>
            <td class="fdv-td-sm">{{ fmtSize(row.left?.size ?? row.right?.size) }}</td>
            <td class="fdv-td-sm fdv-time">{{ fmtTime(row.left?.modified ?? row.right?.modified) }}</td>
            <td class="fdv-td-sm">
              <span class="fdv-status-badge" :class="`badge-${statusColor(row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown')}`">
                {{ { same:'=', modified:'~', 'left-only':'◀', 'right-only':'▶', unknown:'?' }[row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown'] }}
              </span>
            </td>
            <td class="fdv-td-sm" />
            <td class="fdv-td-name">
              <span class="fdv-node-icon">{{ row.isDir ? '📁' : '📄' }}</span>
              {{ row.right?.name ?? '' }}
            </td>
            <td class="fdv-td-sm">{{ fmtSize(row.right?.size) }}</td>
            <td class="fdv-td-sm fdv-time">{{ fmtTime(row.right?.modified) }}</td>
          </tr>
          <tr v-if="!allNodes.length && !loading" class="fdv-row">
            <td colspan="8" class="fdv-empty">
              📂 {{ $t('folder_diff.no_folders') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Sync Panel (slides in from right) -->
    <div v-if="showSyncPanel" class="fdv-sync-panel">
      <div class="fdv-sync-hdr">
        <div class="fdv-sync-title">🔄 {{ $t('folder_sync.sync_preview') || 'Sync Preview' }}</div>
        <button class="fdv-close-btn" @click="showSyncPanel = false">✕</button>
      </div>

      <!-- Mode description -->
      <div class="fdv-sync-mode-desc">
        <div class="fdv-mode-name">{{ syncModeOptions.find(o => o.value === syncMode)?.label }}</div>
        <div class="fdv-mode-sub">{{ syncModeOptions.find(o => o.value === syncMode)?.desc }}</div>
      </div>

      <!-- Progress -->
      <div v-if="syncRunning" class="fdv-progress">
        <div class="fdv-progress-bar">
          <div class="fdv-progress-fill" :style="`width:${syncProgress / syncTotal * 100}%`" />
        </div>
        <div class="fdv-progress-txt">{{ syncProgress }} / {{ syncTotal }}</div>
      </div>

      <!-- Action list -->
      <div class="fdv-sync-list">
        <div v-if="!syncPreview.length" class="fdv-sync-empty">✓ No actions needed — folders are in sync!</div>
        <div v-for="(a, i) in syncPreview" :key="i" class="fdv-sync-item" :class="`item-${a.action} item-${a.direction}`">
          <span class="fdv-item-icon">{{ a.action === 'copy' ? (a.direction === 'right' ? '→' : '←') : '✕' }}</span>
          <span class="fdv-item-action">{{ a.action === 'copy' ? 'Copy' : 'Delete' }}</span>
          <span class="fdv-item-path">{{ a.path }}</span>
          <span class="fdv-item-status" :class="`st-${a.status}`">
            {{ a.status === 'pending' ? '○' : a.status === 'done' ? '✓' : '✗' }}
          </span>
        </div>
      </div>

      <!-- Execute -->
      <div class="fdv-sync-actions">
        <button class="fdv-btn-exec" :disabled="syncRunning || !syncPreview.length" @click="executeSync">
          ⚡ {{ $t('folder_sync.execute') || 'Execute Sync' }}
        </button>
        <button class="fdv-btn-cancel" @click="showSyncPanel = false">{{ $t('common.cancel') }}</button>
      </div>

      <!-- Log -->
      <div class="fdv-sync-log">
        <div class="fdv-log-title">📋 Log</div>
        <div v-for="(e, i) in syncLog" :key="i" class="fdv-log-entry" :class="`log-${e.type}`">{{ e.time }} {{ e.msg }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fdv { display:flex; flex-direction:column; height:100%; overflow:hidden; background:var(--color-bg); position:relative }

/* Breadcrumb */
.fdv-crumb { display:flex; align-items:center; gap:4px; padding:3px 16px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); font-size:11px }
.crumb-home { color:var(--color-text-muted); background:none; border:none; cursor:pointer; padding:0; font-size:11px }
.crumb-home:hover { color:var(--color-accent) }
.crumb-sep { color:var(--color-border) }
.crumb-cur { color:var(--color-text); font-weight:600 }
.crumb-file { color:var(--color-accent); font-family:monospace; font-size:11px }

/* Toolbar */
.fdv-toolbar { display:flex; align-items:center; gap:4px; padding:4px 8px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); flex-wrap:wrap; min-height:38px }
.fdv-btn-path { display:flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); cursor:pointer; font-size:12px; max-width:220px; overflow:hidden; color:var(--color-text) }
.fdv-btn-path:hover { border-color:var(--color-accent) }
.fdv-lbl { font-size:10px; font-weight:700; color:var(--color-text-muted); flex-shrink:0 }
.fdv-path-txt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0 }
.fdv-btn { padding:4px 10px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; transition:all .15s }
.fdv-btn:hover { border-color:var(--color-accent); color:var(--color-accent) }
.fdv-btn:disabled { opacity:.45; cursor:not-allowed }
.fdv-btn-on { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.fdv-sel { padding:3px 6px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:11px; cursor:pointer }
.fdv-sep { flex:1 }

/* Filter */
.fdv-filter { display:flex; align-items:center; gap:4px; padding:3px 8px; background:var(--color-bg2); border-bottom:1px solid var(--color-border) }
.fdv-filter-lbl { font-size:11px; color:var(--color-text-muted) }
.fdv-filter-btn { padding:2px 8px; border-radius:4px; border:1px solid transparent; background:transparent; color:var(--color-text-muted); font-size:11px; cursor:pointer }
.fdv-filter-btn:hover { border-color:var(--color-border); color:var(--color-text) }
.fdv-filter-btn.active { border-color:var(--color-accent); background:rgba(59,130,246,.12); color:var(--color-accent) }
.fdv-input { padding:2px 6px; border:1px solid var(--color-border); border-radius:4px; background