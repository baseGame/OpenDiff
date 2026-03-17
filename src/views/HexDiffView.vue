<script setup lang="ts">
/**
 * HexDiffView — Phase 3
 * Binary file comparison in hexdump format
 */
import { ref, computed, onMounted } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

const tabStore  = useTabStore()
const activeTab = computed(() => tabStore.activeTab)

const leftPath  = ref('')
const rightPath = ref('')
const leftBytes  = ref<number[]>([])
const rightBytes = ref<number[]>([])
const loading    = ref(false)
const error      = ref<string | null>(null)

const BYTES_PER_ROW = 16
const MAX_ROWS = 4096 // limit display to ~64KB for performance

async function loadFile(side: 'left' | 'right') {
  const path = await open({ multiple: false, title: `Select ${side} binary file` }) as string | null
  if (!path) return
  try {
    loading.value = true
    // Read as base64 via tauri fs plugin
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const data = await readFile(path)
    const bytes = Array.from(new Uint8Array(data))
    if (side === 'left') { leftPath.value = path; leftBytes.value = bytes }
    else { rightPath.value = path; rightBytes.value = bytes }
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

interface HexRow {
  offset: number
  leftHex:    string[]
  rightHex:   string[]
  leftAscii:  string
  rightAscii: string
  isDiff: boolean
  cellDiff: boolean[]
}

const hexRows = computed((): HexRow[] => {
  const maxLen = Math.max(leftBytes.value.length, rightBytes.value.length)
  const rows: HexRow[] = []
  for (let offset = 0; offset < Math.min(maxLen, MAX_ROWS * BYTES_PER_ROW); offset += BYTES_PER_ROW) {
    const lSlice = leftBytes.value.slice(offset, offset + BYTES_PER_ROW)
    const rSlice = rightBytes.value.slice(offset, offset + BYTES_PER_ROW)
    const cellDiff: boolean[] = []
    let rowDiff = false
    for (let i = 0; i < BYTES_PER_ROW; i++) {
      const diff = lSlice[i] !== rSlice[i]
      cellDiff.push(diff)
      if (diff) rowDiff = true
    }
    rows.push({
      offset,
      leftHex:  Array.from({ length: BYTES_PER_ROW }, (_, i) => lSlice[i] != null ? lSlice[i].toString(16).padStart(2, '0') : '  '),
      rightHex: Array.from({ length: BYTES_PER_ROW }, (_, i) => rSlice[i] != null ? rSlice[i].toString(16).padStart(2, '0') : '  '),
      leftAscii:  lSlice.map(b => b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.').join(''),
      rightAscii: rSlice.map(b => b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.').join(''),
      isDiff: rowDiff,
      cellDiff,
    })
  }
  return rows
})

const diffCount = computed(() => hexRows.value.filter(r => r.isDiff).length)

onMounted(() => {
  if (activeTab.value?.leftPath)  leftPath.value  = activeTab.value.leftPath
  if (activeTab.value?.rightPath) rightPath.value = activeTab.value.rightPath
})
</script>

<template>
  <div class="hex-diff-view flex flex-col h-full overflow-hidden">
    <!-- Toolbar -->
    <div class="hex-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="loadFile('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftPath || 'Open binary file…' }}</span>
      </button>
      <div class="flex-shrink-0 flex items-center gap-2">
        <span v-if="diffCount" class="badge badge-del">{{ diffCount }} diff rows</span>
        <span v-else-if="hexRows.length" class="badge badge-add">Identical</span>
      </div>
      <button class="path-btn btn" @click="loadFile('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightPath || 'Open binary file…' }}</span>
      </button>
    </div>

    <div v-if="loading" class="diff-status loading">⟳ Loading binary…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Hex grid -->
    <div class="hex-main flex-1 overflow-auto font-mono">
      <table class="hex-table" v-if="hexRows.length">
        <thead>
          <tr>
            <th class="off-col">Offset</th>
            <th class="hex-col" colspan="16">Left Hex (16 bytes)</th>
            <th class="asc-col">ASCII</th>
            <th class="sep-col"></th>
            <th class="hex-col" colspan="16">Right Hex (16 bytes)</th>
            <th class="asc-col">ASCII</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in hexRows" :key="row.offset" :class="row.isDiff ? 'hex-row-diff' : 'hex-row'">
            <td class="off-col">{{ row.offset.toString(16).padStart(8, '0') }}</td>
            <td v-for="(h, i) in row.leftHex" :key="i" :class="['hex-byte', row.cellDiff[i] ? 'byte-diff' : '']">{{ h }}</td>
            <td class="asc-col">{{ row.leftAscii }}</td>
            <td class="sep-col">│</td>
            <td v-for="(h, i) in row.rightHex" :key="i" :class="['hex-byte', row.cellDiff[i] ? 'byte-diff byte-diff-r' : '']">{{ h }}</td>
            <td class="asc-col">{{ row.rightAscii }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="empty-state text-muted">
        <div style="font-size:48px;margin-bottom:12px">🔢</div>
        <p>打开两个二进制文件开始十六进制对比</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hex-diff-view { background: var(--color-bg); }
.hex-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0; min-height: 36px;
}
.path-btn { flex: 1; min-width: 0; font-size: 12px; }
.diff-status { padding: 5px 14px; font-size: 12px; flex-shrink: 0; border-bottom: 1px solid var(--color-border); }
.diff-status.loading { color: var(--color-accent); }
.diff-status.error   { color: var(--color-red); }
.hex-main { overflow: auto; }
.hex-table { border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.hex-table thead tr { background: var(--color-bg3); border-bottom: 2px solid var(--color-border); position: sticky; top: 0; z-index: 2; }
.hex-table th { padding: 5px 4px; font-size: 11px; color: var(--color-text-muted); text-align: center; }
.hex-row, .hex-row-diff { border-bottom: 1px solid rgba(69,71,90,.15); }
.hex-row-diff td { background: rgba(137,180,250,.05); }
.off-col { padding: 2px 8px; color: var(--color-text-muted); font-size: 11px; min-width: 80px; }
.hex-byte { padding: 2px 4px; text-align: center; width: 22px; min-width: 22px; }
.byte-diff { background: rgba(243,139,168,.35) !important; color: var(--color-red); font-weight: 700; border-radius: 2px; }
.byte-diff-r { background: rgba(166,227,161,.35) !important; color: var(--color-green); }
.asc-col { padding: 2px 8px; color: var(--color-text-muted); letter-spacing: 1px; border-left: 1px solid var(--color-border); }
.sep-col { padding: 2px 4px; color: var(--color-border); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
.badge-add { background: rgba(166,227,161,.2); color: var(--color-green); display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
.badge-del { background: rgba(243,139,168,.2); color: var(--color-red); display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
</style>
