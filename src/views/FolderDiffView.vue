<script setup lang="ts">
/**
 * FolderDiffView — Phase 2
 * Features: dual folder tree, diff coloring, filter, sync operations, file comparison drill-in
 */
import { ref, computed, onMounted } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { listDir, statPath, copyFile, deletePath, renamePath, diffFolders } from '@/api'
import type { VfsEntry, FolderDiffResult, FolderEntry } from '@/types'
import { open } from '@tauri-apps/plugin-dialog'
import { useRouter } from 'vue-router'

const tabStore = useTabStore()
const router   = useRouter()
const activeTab = computed(() => tabStore.activeTab)

// ── Paths ─────────────────────────────────────────────────────────────
const leftRoot  = ref('')
const rightRoot = ref('')

// ── Tree state ────────────────────────────────────────────────────────
const leftTree  = ref<TreeNode[]>([])
const rightTree = ref<TreeNode[]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)

// ── Filter ────────────────────────────────────────────────────────────
type FilterMode = 'all' | 'diffs' | 'same' | 'left-only' | 'right-only'
const filterMode = ref<FilterMode>('all')
const excludeGlob = ref('')

// ── Compare mode ──────────────────────────────────────────────────────
type CompareMode = 'time' | 'size' | 'crc'
const compareMode = ref<CompareMode>('time')

// ── Operations status ─────────────────────────────────────────────────
const opLog = ref<string[]>([])
const opRunning = ref(false)
type SyncMode = 'update-left' | 'update-right' | 'update-both' | 'mirror-left' | 'mirror-right'
const syncMode = ref<SyncMode>('update-right')
const showSyncPanel = ref(false)
const syncPreview = ref<SyncAction[]>([])
const syncLog = ref<SyncLogEntry[]>([])
const syncRunning = ref(false)
const syncProgress = ref(0)
const syncTotal = ref(0)
interface SyncAction { action:'copy'|'delete'; direction:'left'|'right'; path:string; leftPath:string; rightPath:string; size?:number; modified?:number; status:'pending'|'done'|'error'; errorMsg?:string }
interface SyncLogEntry { time:string; msg:string; type:'info'|'success'|'error' }
const syncModeOptions = [
  { value:'update-right', label:'→ Update Right', desc:'Copy newer+orphans Left→Right', icon:'→' },
  { value:'update-left',  label:'← Update Left',  desc:'Copy newer+orphans Right→Left', icon:'←' },
  { value:'update-both',   label:'↔ Update Both', desc:'Copy newer files both ways', icon:'↔' },
  { value:'mirror-right',  label:'⇉ Mirror Right',desc:'Make Right identical to Left', icon:'⇉' },
  { value:'mirror-left',   label:'⇇ Mirror Left',  desc:'Make Left identical to Right', icon:'⇇' },
]
function computeSyncPreview() {
  syncPreview.value = []
  for (const row of allNodes.value) {
    if ((row as any).isDir || !row.left || !row.right) continue
    const st = String(row.left?.diffStatus ?? '')
    const lm = row.left.modified ?? 0, rm = row.right?.modified ?? 0
    const ls = row.left.size ?? 0, rs = row.right?.size ?? 0
    if (syncMode.value === 'update-right') {
      if (st === 'left-only') syncPreview.value.push({ action:'copy', direction:'right', path:row.left.name, leftPath:row.left.path, rightPath:`${rightRoot.value}/${row.left.name}`, size:ls, modified:lm, status:'pending' as const })
      else if (st === 'modified' && lm > rm) syncPreview.value.push({ action:'copy', direction:'right', path:row.left.name, leftPath:row.left.path, rightPath:`${rightRoot.value}/${row.left.name}`, size:ls, modified:lm, status:'pending' as const })
    } else if (syncMode.value === 'update-left') {
      if (st === 'right-only' && row.right) syncPreview.value.push({ action:'copy', direction:'left', path:row.right.name, leftPath:`${leftRoot.value}/${row.right.name}`, rightPath:row.right.path, size:rs, modified:rm, status:'pending' as const })
      else if (st === 'modified' && rm > lm && row.right) syncPreview.value.push({ action:'copy', direction:'left', path:row.right.name, leftPath:`${leftRoot.value}/${row.right.name}`, rightPath:row.right.path, size:rs, modified:rm, status:'pending' as const })
    } else if (syncMode.value === 'update-both') {
      if (st === 'modified') {
        if (lm > rm) syncPreview.value.push({ action:'copy', direction:'right', path:row.left.name, leftPath:row.left.path, rightPath:`${rightRoot.value}/${row.left.name}`, size:ls, modified:lm, status:'pending' as const })
        if (rm > lm && row.right) syncPreview.value.push({ action:'copy', direction:'left', path:row.right.name, leftPath:`${leftRoot.value}/${row.right.name}`, rightPath:row.right.path, size:rs, modified:rm, status:'pending' as const })
      }
    } else if (syncMode.value === 'mirror-right') {
      if (st === 'left-only' || st === 'modified') syncPreview.value.push({ action:'copy', direction:'right', path:row.left.name, leftPath:row.left.path, rightPath:`${rightRoot.value}/${row.left.name}`, size:ls, modified:lm, status:'pending' as const })
      if (st === 'right-only' && row.right) syncPreview.value.push({ action:'delete', direction:'right', path:row.right.name, leftPath:'', rightPath:row.right.path, size:rs, modified:rm, status:'pending' as const })
    } else if (syncMode.value === 'mirror-left') {
      if (st === 'right-only' && row.right) syncPreview.value.push({ action:'copy', direction:'left', path:row.right.name, leftPath:`${leftRoot.value}/${row.right.name}`, rightPath:row.right.path, size:rs, modified:rm, status:'pending' as const })
      if (st === 'modified' && row.right) syncPreview.value.push({ action:'copy', direction:'left', path:row.right.name, leftPath:`${leftRoot.value}/${row.right.name}`, rightPath:row.right.path, size:rs, modified:rm, status:'pending' as const })
      if (st === 'left-only') syncPreview.value.push({ action:'delete', direction:'left', path:row.left.name, leftPath:row.left.path, rightPath:'', size:ls, modified:lm, status:'pending' as const })
    }
  }
  // Right-only orphans
  for (const rn of rightTree.value) {
    if (rn.diffStatus !== 'right-only' || rn.kind !== 'file') continue
    if (syncMode.value === 'update-left') syncPreview.value.push({ action:'copy', direction:'left', path:rn.name, leftPath:`${leftRoot.value}/${rn.name}`, rightPath:rn.path, size:rn.size, modified:rn.modified, status:'pending' as const })
    else if (syncMode.value === 'mirror-right') syncPreview.value.push({ action:'delete', direction:'right', path:rn.name, leftPath:'', rightPath:rn.path, size:rn.size, modified:rn.modified, status:'pending' as const })
  }
  if (syncMode.value === 'mirror-left') {
    for (const ln of leftTree.value) { if (ln.diffStatus === 'left-only' && ln.kind === 'file') syncPreview.value.push({ action:'delete', direction:'left', path:ln.name, leftPath:ln.path, rightPath:'', size:ln.size, modified:ln.modified, status:'pending' as const }) }
  }
  showSyncPanel.value = true
  addSyncLog('info', `${syncPreview.value.length} action(s) for "${syncModeOptions.find(o => o.value === syncMode.value)?.label}"`)
}
async function executeSync() {
  if (!syncPreview.value.length) return
  syncRunning.value = true; syncTotal.value = syncPreview.value.length; syncProgress.value = 0
  addSyncLog('info', `Starting sync: ${syncTotal.value} operation(s)...`)
  for (const a of syncPreview.value) {
    try {
      if (a.action === 'copy') {
        a.direction === 'right' ? await copyFile(a.leftPath, a.rightPath) : await copyFile(a.rightPath, a.leftPath)
        a.status = 'done'; addSyncLog('success', `✓ Copied: ${a.path}`)
      } else {
        a.direction === 'right' && a.rightPath ? await deletePath(a.rightPath) : a.leftPath ? await deletePath(a.leftPath) : undefined
        a.status = 'done'; addSyncLog('success', `✓ Deleted: ${a.path}`)
      }
    } catch(e:any) { a.status = 'error'; a.errorMsg = String(e); addSyncLog('error', `✗ ${a.path}: ${e}`) }
    syncProgress.value++
  }
  syncRunning.value = false
  addSyncLog('info', `Done: ${syncPreview.value.filter(a => a.status === 'done').length}/${syncTotal.value} succeeded.`)
  await loadAndCompare()
}
function addSyncLog(type: SyncLogEntry['type'], msg: string) {
  const t = new Date().toLocaleTimeString()
  syncLog.value.unshift({ time: t, msg, type })
  if (syncLog.value.length > 100) syncLog.value.pop()
}

interface TreeNode {
  name: string
  path: string
  kind: 'file' | 'directory'
  size?: number
  modified?: number
  diffStatus: 'same' | 'modified' | 'left-only' | 'right-only' | 'unknown'
  children?: TreeNode[]
  expanded: boolean
  paired?: TreeNode // matching node on the other side
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
  loading.value = true
  error.value = null
  try {
    // Try Rust backend for CRC32-based deep folder comparison
    let rustResult: FolderDiffResult | null = null
    try {
      rustResult = await diffFolders(leftRoot.value, rightRoot.value, {
        ignorePatterns: excludeGlob.value ? excludeGlob.value.split(';').map(s => s.trim()).filter(Boolean) : [],
        compareContent: compareMode.value === 'crc',
        compareTime: compareMode.value === 'time',
        compareSize: compareMode.value === 'size',
      } as any)
    } catch (_) {
      // Fallback to client-side comparison
    }

    const [leftEntries, rightEntries] = await Promise.all([
      listDir(leftRoot.value),
      listDir(rightRoot.value),
    ])
    leftTree.value  = await buildTree(leftEntries, leftRoot.value, 'left', rustResult)
    rightTree.value = await buildTree(rightEntries, rightRoot.value, 'right', rustResult)
    if (rustResult) {
      applyRustResult(rustResult)
    } else {
      pairAndCompare(leftTree.value, rightTree.value)
    }
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

async function buildTree(entries: any[], root: string, _side: string, _rustResult?: FolderDiffResult | null): Promise<TreeNode[]> {
  return entries.map(e => ({
    name: e.name,
    path: e.path['0'] ?? `${root}/${e.name}`,
    kind: e.kind === 'directory' ? 'directory' : 'file',
    size: e.metadata.size,
    modified: e.metadata.modified,
    diffStatus: 'unknown' as const,
    children: undefined,
    expanded: false,
    paired: undefined,
  }))
}

function applyRustResult(result: FolderDiffResult) {
  const entryMap = new Map<string, FolderEntry>()
  for (const e of result.entries ?? []) {
    entryMap.set(e.rel_path, e)
  }
  function applyToNodes(nodes: TreeNode[]) {
    for (const node of nodes) {
      const entry = entryMap.get(node.name)
      if (entry) {
        const leftStatus = entry.left_status
        const rightStatus = entry.right_status
        if (leftStatus === 'LeftOnly') node.diffStatus = 'left-only'
        else if (rightStatus === 'RightOnly') node.diffStatus = 'right-only'
        else if (leftStatus === 'Modified' || rightStatus === 'Modified') node.diffStatus = 'modified'
        else node.diffStatus = 'same'
      }
      if (node.children) applyToNodes(node.children)
    }
  }
  applyToNodes(leftTree.value)
  applyToNodes(rightTree.value)
}

function pairAndCompare(left: TreeNode[], right: TreeNode[]) {
  const rightMap = new Map(right.map(n => [n.name, n]))
  const leftMap  = new Map(left.map(n => [n.name, n]))

  for (const ln of left) {
    const rn = rightMap.get(ln.name)
    if (!rn) {
      ln.diffStatus = 'left-only'
    } else {
      ln.paired = rn
      rn.paired = ln
      ln.diffStatus = rn.diffStatus = compareNodes(ln, rn)
    }
  }
  for (const rn of right) {
    if (!leftMap.has(rn.name)) {
      rn.diffStatus = 'right-only'
    }
  }
}

function compareNodes(l: TreeNode, r: TreeNode): 'same' | 'modified' {
  switch (compareMode.value) {
    case 'size': return l.size === r.size ? 'same' : 'modified'
    case 'time': return Math.abs((l.modified ?? 0) - (r.modified ?? 0)) < 2000 ? 'same' : 'modified'
    default: return l.size === r.size ? 'same' : 'modified' // CRC: fallback to size for now
  }
}

// ── Toggle expand ──────────────────────────────────────────────────────
async function toggleExpand(node: TreeNode, side: 'left' | 'right') {
  if (node.kind !== 'directory') return
  node.expanded = !node.expanded
  if (node.expanded && !node.children) {
    try {
      const entries = await listDir(node.path)
      node.children = await buildTree(entries, node.path, side)
      // Pair with sibling if available
      if (node.paired && !node.paired.children) {
        const sibEntries = await listDir(node.paired.path)
        node.paired.children = await buildTree(sibEntries, node.paired.path, side === 'left' ? 'right' : 'left')
      }
      if (node.children && node.paired?.children) {
        pairAndCompare(node.children, node.paired.children)
      }
    } catch (e: any) {
      error.value = String(e)
    }
  }
}

// ── File operations ────────────────────────────────────────────────────
async function copyToRight(node: TreeNode) {
  if (!node.paired && node.diffStatus === 'left-only') {
    const dst = node.path.replace(leftRoot.value, rightRoot.value)
    opRunning.value = true
    try {
      await copyFile(node.path, dst)
      opLog.value.unshift(`✅ Copied: ${node.name} → right`)
      node.diffStatus = 'same'
    } catch (e: any) {
      opLog.value.unshift(`❌ Failed: ${e}`)
    } finally {
      opRunning.value = false
    }
  }
}

async function copyToLeft(node: TreeNode) {
  if (!node.paired && node.diffStatus === 'right-only') {
    const dst = node.path.replace(rightRoot.value, leftRoot.value)
    opRunning.value = true
    try {
      await copyFile(node.path, dst)
      opLog.value.unshift(`✅ Copied: ${node.name} → left`)
      node.diffStatus = 'same'
    } catch (e: any) {
      opLog.value.unshift(`❌ Failed: ${e}`)
    } finally {
      opRunning.value = false
    }
  }
}

async function openFileDiff(node: TreeNode) {
  if (node.kind !== 'file' || !node.paired) return
  tabStore.openNewDiff('text_diff', node.path, node.paired.path)
  router.push('/text-diff')
}

// ── Combined display rows ─────────────────────────────────────────────
// ── Stats ─────────────────────────────────────────────────────────────
const folderStats = computed(() => {
  let same = 0, mod = 0, lo = 0, ro = 0
  for (const row of allNodes.value) {
    const s = row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown'
    if (s === 'same') same++
    else if (s === 'modified') mod++
    else if (s === 'left-only') lo++
    else if (s === 'right-only') ro++
  }
  return { same, modified: mod, 'left-only': lo, 'right-only': ro, total: same + mod + lo + ro }
})

const allNodes = computed((): Array<{ left?: TreeNode; right?: TreeNode; depth: number; isDir: boolean }> => {
  const rows: Array<{ left?: TreeNode; right?: TreeNode; depth: number; isDir: boolean }> = []
  function walkPair(ls: TreeNode[], rs: TreeNode[], depth: number) {
    const allNames = new Set([...ls.map(n => n.name), ...rs.map(n => n.name)])
    const lMap = new Map(ls.map(n => [n.name, n]))
    const rMap = new Map(rs.map(n => [n.name, n]))
    for (const name of allNames) {
      const l = lMap.get(name)
      const r = rMap.get(name)
      const status = l?.diffStatus ?? r?.diffStatus ?? 'unknown'
      if (filterMode.value !== 'all') {
        const keep = (
          (filterMode.value === 'diffs'      && status !== 'same') ||
          (filterMode.value === 'same'       && status === 'same') ||
          (filterMode.value === 'left-only'  && status === 'left-only') ||
          (filterMode.value === 'right-only' && status === 'right-only')
        )
        if (!keep) continue
      }
      rows.push({ left: l, right: r, depth, isDir: (l?.kind ?? r?.kind) === 'directory' })
      // Recurse into expanded directories
      if (l?.expanded && l.children) {
        walkPair(l.children, r?.children ?? [], depth + 1)
      }
    }
  }
  walkPair(leftTree.value, rightTree.value, 0)
  return rows
})

function statusColor(status: string): string {
  return { same: '', modified: 'mod', 'left-only': 'del', 'right-only': 'add', unknown: '' }[status] ?? ''
}

function statusIcon(status: string): string {
  return { same: '=', modified: '~', 'left-only': '◀', 'right-only': '▶', unknown: '?' }[status] ?? '?'
}

function fmtSize(bytes?: number): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes/1024).toFixed(1)}K`
  return `${(bytes/1024/1024).toFixed(1)}M`
}

function fmtTime(ms?: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleString()
}

onMounted(() => {
  if (activeTab.value?.leftPath && activeTab.value?.rightPath) {
    leftRoot.value = activeTab.value.leftPath
    rightRoot.value = activeTab.value.rightPath
    loadAndCompare()
  }
})
</script>

<template>
  <div class="folder-diff-view flex flex-col h-full overflow-hidden">

    <!-- Toolbar -->
    <div class="folder-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="pickFolder('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftRoot || 'Open folder…' }}</span>
      </button>

      <div class="flex items-center gap-1 flex-shrink-0">
        <button class="btn btn-primary" :disabled="opRunning" @click="loadAndCompare">⟳</button>
        <select class="input" style="width:100px" v-model="compareMode" @change="loadAndCompare">
          <option value="time">By Time</option>
          <option value="size">By Size</option>
          <option value="crc">By CRC</option>
        </select>
      </div>

      <button class="path-btn btn" @click="pickFolder('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightRoot || 'Open folder…' }}</span>
      </button>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar flex items-center gap-2">
      <span class="text-muted text-xs">Show:</span>
      <button v-for="m in ['all','diffs','same','left-only','right-only']" :key="m"
        class="btn btn-icon filter-btn" :class="{ active: filterMode === m }"
        @click="filterMode = m as FilterMode"
      >{{ m }}</button>
      <div class="flex-1" />
      <input v-model="excludeGlob" class="input" style="width:180px" placeholder="Exclude: *.tmp;*.log"
        @keydown.enter="loadAndCompare" title="Press Enter to apply exclude filter" />
      <!-- Stats summary -->
      <div v-if="folderStats.total > 0" class="stats-summary text-xs">
        <span class="stat-eq">✓ {{ folderStats.same }}</span>
        <span class="stat-mod">~ {{ folderStats.modified }}</span>
        <span class="stat-lo">← {{ folderStats['left-only'] }}</span>
        <span class="stat-ro">{{ folderStats['right-only'] }} →</span>
        <span class="text-muted">/ {{ folderStats.total }} files</span>
      </div>
    </div>

    <!-- Status -->
    <div v-if="loading" class="diff-status loading">⟳ Scanning folders…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Main tree table -->
    <div class="folder-main flex-1 overflow-auto">
      <table class="folder-table">
        <thead>
          <tr>
            <th class="col-name">Left File</th>
            <th class="col-size">Size</th>
            <th class="col-time">Modified</th>
            <th class="col-status">Status</th>
            <th class="col-actions"></th>
            <th class="col-name">Right File</th>
            <th class="col-size">Size</th>
            <th class="col-time">Modified</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in allNodes"
            :key="i"
            class="folder-row"
            :class="`status-${statusColor(row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown')}`"
            @dblclick="row.left?.kind === 'file' && row.left?.paired ? openFileDiff(row.left) : undefined"
          >
            <!-- Left name -->
            <td class="col-name">
              <span :style="`padding-left: ${row.depth * 16 + 4}px`" class="node-name">
                <span v-if="row.left?.kind === 'directory'" class="dir-arrow" @click="toggleExpand(row.left!, 'left')">
                  {{ row.left.expanded ? '▾' : '▸' }}
                </span>
                <span v-else class="file-icon">{{ row.left ? '📄' : '' }}</span>
                {{ row.left?.name ?? '' }}
              </span>
            </td>
            <td class="col-size text-muted text-xs">{{ fmtSize(row.left?.size) }}</td>
            <td class="col-time text-muted text-xs">{{ fmtTime(row.left?.modified) }}</td>

            <!-- Status -->
            <td class="col-status text-center">
              <span class="status-badge" :class="`badge-${statusColor(row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown')}`">
                {{ statusIcon(row.left?.diffStatus ?? row.right?.diffStatus ?? 'unknown') }}
              </span>
            </td>

            <!-- Actions -->
            <td class="col-actions">
              <div class="action-btns">
                <button v-if="row.left?.diffStatus === 'left-only'" class="btn btn-icon action-btn" title="Copy → Right" @click="copyToRight(row.left!)">▶</button>
                <button v-if="row.right?.diffStatus === 'right-only'" class="btn btn-icon action-btn" title="Copy → Left" @click="copyToLeft(row.right!)">◀</button>
                <button v-if="row.left?.kind === 'file' && row.left?.paired" class="btn btn-icon action-btn" title="Compare files" @click="openFileDiff(row.left!)">⚡</button>
              </div>
            </td>

            <!-- Right name -->
            <td class="col-name">
              <span :style="`padding-left: ${row.depth * 16 + 4}px`" class="node-name">
                <span v-if="row.right?.kind === 'directory'" class="dir-arrow" @click="toggleExpand(row.right!, 'right')">
                  {{ row.right.expanded ? '▾' : '▸' }}
                </span>
                <span v-else class="file-icon">{{ row.right ? '📄' : '' }}</span>
                {{ row.right?.name ?? '' }}
              </span>
            </td>
            <td class="col-size text-muted text-xs">{{ fmtSize(row.right?.size) }}</td>
            <td class="col-time text-muted text-xs">{{ fmtTime(row.right?.modified) }}</td>
          </tr>
          <tr v-if="!allNodes.length && !loading">
            <td colspan="8" class="empty-row text-muted">
              {{ leftRoot && rightRoot ? '无差异或目录为空' : '请选择两个文件夹开始对比' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Op log -->
    <div v-if="opLog.length" class="op-log">
      <div v-for="(msg, i) in opLog.slice(0, 5)" :key="i" class="op-msg text-xs">{{ msg }}</div>
    </div>

  <!-- Sync panel -->
  <div v-if="showSyncPanel" class="fdv-sync-panel">
    <div class="fdv-sync-hdr">
      <div class="fdv-sync-title">🔄 Sync Preview</div>
      <button class="fdv-close-btn" @click="showSyncPanel = false">✕</button>
    </div>
    <div class="fdv-sync-mode-desc">
      <div class="fdv-mode-name">{{ syncModeOptions.find(o => o.value === syncMode)?.label }}</div>
      <div class="fdv-mode-sub">{{ syncModeOptions.find(o => o.value === syncMode)?.desc }}</div>
    </div>
    <div v-if="syncRunning" class="fdv-progress">
      <div class="fdv-progress-bar"><div class="fdv-progress-fill" :style="`width:${syncProgress / syncTotal * 100}%`"/></div>
      <div class="fdv-progress-txt">{{ syncProgress }} / {{ syncTotal }}</div>
    </div>
    <div class="fdv-sync-list">
      <div v-if="!syncPreview.length" class="fdv-sync-empty">✓ No actions needed — folders are in sync!</div>
      <div v-for="(a, i) in syncPreview" :key="i" class="fdv-sync-item">
        <span>{{ a.action === 'copy' ? (a.direction === 'right' ? '→' : '←') : '✕' }}</span>
        <span class="fdv-item-action">{{ a.action === 'copy' ? 'Copy' : 'Delete' }}</span>
        <span class="fdv-item-path">{{ a.path }}</span>
        <span :class="`st-${a.status}`">{{ a.status === 'done' ? '✓' : a.status === 'error' ? '✗' : '○' }}</span>
      </div>
    </div>
    <div class="fdv-sync-actions">
      <button class="fdv-btn-exec" :disabled="syncRunning || !syncPreview.length" @click="executeSync">⚡ Execute Sync</button>
      <button class="fdv-btn-cancel" @click="showSyncPanel = false">Cancel</button>
    </div>
    <div class="fdv-sync-log">
      <div class="fdv-log-title">📋 Log</div>
      <div v-for="(e, i) in syncLog" :key="i" :class="`fdv-log-entry log-${e.type}`">{{ e.time }} {{ e.msg }}</div>
    </div>
  </div>
  </div>
</template>

<style scoped>
.folder-diff-view { background: var(--color-bg); }

.folder-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0; min-height: 38px;
}
.path-btn { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 12px; }

.filter-bar {
  background: var(--color-bg3); border-bottom: 1px solid var(--color-border);
  padding: 4px 10px; flex-shrink: 0; gap: 4px;
}
.filter-btn { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.filter-btn.active { background: var(--color-accent); color: var(--color-bg); border-color: var(--color-accent); }
.stats-summary { display: flex; align-items: center; gap: 8px; padding: 2px 8px; background: var(--color-surface); border-radius: 12px; border: 1px solid var(--color-border); flex-shrink: 0; }
.stat-eq { color: var(--color-green); font-weight: 600; }
.stat-mod { color: #f59e0b; font-weight: 600; }
.stat-lo { color: var(--color-red); font-weight: 600; }
.stat-ro { color: var(--color-accent); font-weight: 600; }

.diff-status { padding: 5px 14px; font-size: 12px; flex-shrink: 0; border-bottom: 1px solid var(--color-border); }
.diff-status.loading { color: var(--color-accent); }
.diff-status.error   { color: var(--color-red); }

.folder-main { overflow: auto; }
.folder-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.folder-table thead tr { background: var(--color-bg3); border-bottom: 2px solid var(--color-border); }
.folder-table th { padding: 6px 8px; text-align: left; font-size: 11px; font-weight: 700; color: var(--color-text-muted); white-space: nowrap; }
.folder-row { border-bottom: 1px solid rgba(69,71,90,.3); cursor: default; transition: background .1s; }
.folder-row:hover { background: var(--color-surface); }

.col-name   { min-width: 200px; max-width: 360px; }
.col-size   { width: 64px; text-align: right; }
.col-time   { width: 140px; }
.col-status { width: 56px; }
.col-actions{ width: 80px; }

td { padding: 4px 8px; vertical-align: middle; }
.node-name { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.dir-arrow { cursor: pointer; color: var(--color-accent); font-size: 12px; user-select: none; }
.file-icon { font-size: 12px; }

/* Status row colours */
.status-add td  { background: rgba(166,227,161,.06); }
.status-del td  { background: rgba(243,139,168,.06); }
.status-mod td  { background: rgba(137,180,250,.05); }

.status-badge { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 11px; font-weight: 700; }
.badge-mod { background: rgba(137,180,250,.2); color: var(--color-accent); }
.badge-add { background: rgba(166,227,161,.2); color: var(--color-green); }
.badge-del { background: rgba(243,139,168,.2); color: var(--color-red); }

.action-btns { display: flex; gap: 2px; }
.action-btn { padding: 2px 6px; font-size: 11px; }

.empty-row { text-align: center; padding: 32px; font-size: 13px; }

.op-log {
  background: var(--color-bg3); border-top: 1px solid var(--color-border);
  padding: 4px 12px; flex-shrink: 0; max-height: 100px; overflow-y: auto;
}
.op-msg { padding: 1px 0; color: var(--color-text-muted); }
</style>
/* Sync panel */
.fdv-sync-panel { position:absolute; right:0; top:0; bottom:0; width:320px; background:var(--color-bg2); border-left:2px solid var(--color-border); display:flex; flex-direction:column; z-index:50; box-shadow:-8px 0 24px rgba(0,0,0,.3) }
.fdv-sync-hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--color-border); flex-shrink:0 }
.fdv-sync-title { font-size:13px; font-weight:700; color:var(--color-text) }
.fdv-close-btn { background:transparent; border:none; color:var(--color-text-muted); cursor:pointer; font-size:14px }
.fdv-close-btn:hover { color:var(--color-text) }
.fdv-sync-mode-desc { padding:8px 14px; border-bottom:1px solid var(--color-border) }
.fdv-mode-name { font-size:12px; font-weight:600; color:var(--color-accent) }
.fdv-mode-sub { font-size:11px; color:var(--color-text-muted); margin-top:2px }
.fdv-progress { padding:8px 14px }
.fdv-progress-bar { height:6px; background:var(--color-bg3); border-radius:3px; overflow:hidden }
.fdv-progress-fill { height:100%; background:var(--color-accent); border-radius:3px; transition:width .2s }
.fdv-progress-txt { font-size:11px; color:var(--color-text-muted); margin-top:4px; text-align:center }
.fdv-sync-list { flex:1; overflow-y:auto; padding:8px 14px }
.fdv-sync-empty { text-align:center; padding:24px; color:#22c55e; font-size:13px }
.fdv-sync-item { display:flex; align-items:center; gap:6px; padding:5px 8px; border-radius:6px; font-size:12px; margin-bottom:2px; background:var(--color-surface); border:1px solid var(--color-border) }
.fdv-item-action { color:var(--color-text-muted); font-size:11px; flex-shrink:0 }
.fdv-item-path { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--color-text); font-family:monospace }
.fdv-sync-actions { padding:10px 14px; border-top:1px solid var(--color-border); display:flex; gap:8px }
.fdv-btn-exec { flex:1; padding:7px; border-radius:8px; border:none; background:var(--color-accent); color:white; font-size:12px; cursor:pointer; font-weight:600 }
.fdv-btn-exec:hover { background:#2563eb }
.fdv-btn-exec:disabled { opacity:.45; cursor:not-allowed }
.fdv-btn-cancel { padding:7px 12px; border-radius:8px; border:1px solid var(--color-border); background:transparent; color:var(--color-text-muted); font-size:12px; cursor:pointer }
.fdv-sync-log { flex-shrink:0; max-height:140px; overflow-y:auto; padding:8px 14px; border-top:1px solid var(--color-border) }
.fdv-log-title { font-size:11px; color:var(--color-text-muted); margin-bottom:4px }
.fdv-log-entry { font-size:10px; font-family:monospace; padding:1px 0; color:var(--color-text-muted) }
.log-success { color:#22c55e }
.log-error { color:#ef4444 }

