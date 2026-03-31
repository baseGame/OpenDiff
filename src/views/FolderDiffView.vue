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
const allNodes = computed((): Array<{ left?: TreeNode; right?: TreeNode; depth: number }> => {
  const rows: Array<{ left?: TreeNode; right?: TreeNode; depth: number }> = []
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
      rows.push({ left: l, right: r, depth })
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
      <input v-model="excludeGlob" class="input" style="width:180px" placeholder="Exclude: *.tmp;*.log" />
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
