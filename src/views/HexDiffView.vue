<script setup lang="ts">
/**
 * HexDiffView — Phase 3
 * Features: Hex dump comparison, byte-level diff highlighting, offset comparison
 */
import { ref, computed, onMounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { readFileText } from '@/api'

// ── State ──────────────────────────────────────────────────────────────
const leftPath  = ref('')
const rightPath = ref('')
const leftBytes = ref<number[]>([])
const rightBytes= ref<number[]>([])
const loading   = ref(false)
const error     = ref<string | null>(null)
const bytesPerRow = ref(16)
const showAscii  = ref(true)

// ── Load files ────────────────────────────────────────────────────────
async function pickFile(side: 'left' | 'right') {
  const path = await open({
    multiple: false,
    title: `Select ${side} binary file`,
    filters: [{ name: 'All Files', extensions: ['*'] }],
  }) as string | null
  if (!path) return
  if (side === 'left') { leftPath.value = path; leftBytes.value = [] }
  else                { rightPath.value = path; rightBytes.value = [] }
  await loadAndDiff()
}

async function loadAndDiff() {
  if (!leftPath.value || !rightPath.value) return
  loading.value = true
  error.value = null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    // Use Rust backend for binary reading
    const [lBuf, rBuf] = await Promise.all([
      invoke<string[]>('cmd_read_file_bytes', { path: leftPath.value }),
      invoke<string[]>('cmd_read_file_bytes', { path: rightPath.value }),
    ])
    leftBytes.value  = lBuf.map(Number)
    rightBytes.value = rBuf.map(Number)
  } catch (e: any) {
    // Fallback: try text read
    try {
      const [l, r] = await Promise.all([
        readFileText(leftPath.value),
        readFileText(rightPath.value),
      ])
      leftBytes.value  = Array.from(Buffer.from(l, 'binary'))
      rightBytes.value = Array.from(Buffer.from(r, 'binary'))
    } catch {
      error.value = `无法读取文件: ${e}`
    }
  } finally {
    loading.value = false
  }
}

// ── Row generation ────────────────────────────────────────────────────
interface HexRow {
  offset: number
  leftBytes:  (number|null)[]
  rightBytes: (number|null)[]
  leftAscii:  string
  rightAscii: string
  status: 'equal' | 'diff' | 'left-only' | 'right-only'
}

const rows = computed((): HexRow[] => {
  const l = leftBytes.value
  const r = rightBytes.value
  const bpr = bytesPerRow.value
  const maxLen = Math.max(l.length, r.length)
  const result: HexRow[] = []

  for (let i = 0; i < maxLen; i += bpr) {
    const lSlice = l.slice(i, i + bpr)
    const rSlice = r.slice(i, i + bpr)

    let status: HexRow['status'] = 'equal'
    if (i >= l.length) status = 'right-only'
    else if (i >= r.length) status = 'left-only'
    else {
      const lHex = lSlice.map(b => b?.toString(16).padStart(2,'0')).join(' ')
      const rHex = rSlice.map(b => b?.toString(16).padStart(2,'0')).join(' ')
      if (lHex !== rHex) status = 'diff'
    }

    const padLeft  = padBytes(lSlice, bpr)
    const padRight = padBytes(rSlice, bpr)

    result.push({
      offset: i,
      leftBytes:  padLeft,
      rightBytes: padRight,
      leftAscii:  padLeft.map(b => b !== null ? byteToAscii(b) : ' ').join(''),
      rightAscii: padRight.map(b => b !== null ? byteToAscii(b) : ' ').join(''),
      status,
    })
  }
  return result
})

function padBytes(arr: (number|null)[], to: number): (number|null)[] {
  while (arr.length < to) arr.push(null)
  return arr
}

function byteToAscii(b: number): string {
  return (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.'
}

function byteStr(b: number|null): string {
  return b !== null ? b.toString(16).padStart(2, '0') : '  '
}

// ── Stats ──────────────────────────────────────────────────────────────
const stats = computed(() => {
  const l = leftBytes.value, r = rightBytes.value
  let same = 0, diff = 0
  for (let i = 0; i < Math.max(l.length, r.length); i++) {
    if (i >= l.length || i >= r.length) diff++
    else if (l[i] === r[i]) same++
    else diff++
  }
  return { same, diff, leftSize: l.length, rightSize: r.length }
})

onMounted(async () => {
  if (leftPath.value && rightPath.value) await loadAndDiff()
})
</script>

<template>
  <div class="hex-diff-view flex flex-col h-full overflow-hidden">

    <!-- Toolbar -->
    <div class="hex-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="pickFile('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftPath || 'Open binary…' }}</span>
      </button>

      <div class="flex items-center gap-2 flex-shrink-0">
        <label class="flex items-center gap-1 text-xs text-muted">
          <span>Bytes/row:</span>
          <select class="input" style="width:70px" v-model.number="bytesPerRow">
            <option :value="8">8</option>
            <option :value="16">16</option>
            <option :value="32">32</option>
          </select>
        </label>
        <label class="flex items-center gap-1 text-xs">
          <input type="checkbox" v-model="showAscii" />
          <span class="text-muted">ASCII</span>
        </label>
      </div>

      <template v-if="leftBytes.length">
        <span class="text-xs text-muted">L:{{ stats.leftSize }} B</span>
        <span class="badge badge-add">{{ stats.diff }} diff</span>
        <span class="badge badge-del">{{ stats.same }} same</span>
      </template>

      <button class="path-btn btn" @click="pickFile('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightPath || 'Open binary…' }}</span>
      </button>
    </div>

    <!-- Status -->
    <div v-if="loading" class="diff-status loading">⟳ Reading binary data…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Hex table -->
    <div class="hex-main flex-1 overflow-auto font-mono text-xs">

      <!-- Header -->
      <div class="hex-header flex">
        <div class="col-offset">Offset</div>
        <div class="col-bytes" v-if="showAscii">
          <div v-for="col in Math.ceil(bytesPerRow / 2)" :key="col" class="hex-col-group">
            <span>{{ (col-1)*2 }}</span>
            <span>{{ (col-1)*2 + 1 }}</span>
          </div>
        </div>
        <div v-else>
          <div v-for="ci in bytesPerRow" :key="ci" class="hex-col">{{ (ci-1).toString(16).padStart(2,'0') }}</div>
        </div>
        <div class="col-sep" />
        <div class="col-offset">Offset</div>
        <div class="col-bytes">
          <div v-for="ci in bytesPerRow" :key="ci" class="hex-col">{{ (ci-1).toString(16).padStart(2,'0') }}</div>
        </div>
        <div class="col-sep" v-if="showAscii" />
        <div class="col-ascii" v-if="showAscii">Left ASCII</div>
        <div class="col-ascii" v-if="showAscii">Right ASCII</div>
      </div>

      <!-- Rows -->
      <div
        v-for="(row, ri) in rows"
        :key="ri"
        class="hex-row flex"
        :class="`hex-${row.status}`"
      >
        <!-- Left offset -->
        <div class="col-offset hex-cell">{{ row.offset.toString(16).padStart(8,'0') }}</div>

        <!-- Left bytes -->
        <div class="col-bytes flex">
          <template v-for="(b, bi) in row.leftBytes" :key="'lb'+bi">
            <span v-if="bi % 2 === 0 && bytesPerRow > 8" class="hex-space" />
            <span class="hex-byte" :class="{ 'byte-diff': row.status === 'diff' && b !== null && row.rightBytes[bi] !== null && b !== row.rightBytes[bi] }">
              {{ byteStr(b) }}
            </span>
          </template>
        </div>

        <div class="col-sep" />

        <!-- Right offset -->
        <div class="col-offset hex-cell">{{ row.offset.toString(16).padStart(8,'0') }}</div>

        <!-- Right bytes -->
        <div class="col-bytes flex">
          <template v-for="(b, bi) in row.rightBytes" :key="'rb'+bi">
            <span v-if="bi % 2 === 0 && bytesPerRow > 8" class="hex-space" />
            <span class="hex-byte" :class="{ 'byte-diff': row.status === 'diff' && b !== null && row.leftBytes[bi] !== null && b !== row.leftBytes[bi] }">
              {{ byteStr(b) }}
            </span>
          </template>
        </div>

        <div class="col-sep" v-if="showAscii" />

        <!-- ASCII -->
        <div v-if="showAscii" class="col-ascii hex-cell ascii-left">{{ row.leftAscii }}</div>
        <div v-if="showAscii" class="col-ascii hex-cell ascii-right">{{ row.rightAscii }}</div>
      </div>

      <!-- Empty -->
      <div v-if="!rows.length && !loading" class="text-muted text-center p-8">
        {{ leftPath ? '无差异' : '请选择两个二进制文件开始对比' }}
      </div>
    </div>

  </div>
</template>

<style scoped>
.hex-diff-view { background: var(--color-bg); }

.hex-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0; min-height: 38px;
}
.path-btn { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 12px; }

.diff-status {
  padding: 5px 14px; font-size: 12px; flex-shrink: 0; border-bottom: 1px solid var(--color-border);
}
.diff-status.loading { color: var(--color-accent); }
.diff-status.error   { color: var(--color-red); }

/* Hex table */
.hex-main { overflow: auto; }
.hex-header {
  position: sticky; top: 0; z-index: 2;
  background: var(--color-bg3); border-bottom: 2px solid var(--color-border);
  padding: 4px 0; font-size: 10px; color: var(--color-text-muted);
}
.hex-row { border-bottom: 1px solid rgba(69,71,90,.2); }
.hex-row:hover { background: var(--color-surface); }

.col-offset  { width: 80px; flex-shrink: 0; }
.col-bytes   { flex-shrink: 0; display: flex; flex-wrap: wrap; }
.col-sep     { width: 6px; flex-shrink: 0; background: var(--color-border); margin: 0 2px; }
.col-ascii   { width: 160px; flex-shrink: 0; overflow: hidden; }
.hex-cell    { padding: 2px 8px; white-space: pre; }
.hex-col     { width: 24px; text-align: center; flex-shrink: 0; }
.hex-col-group { display: flex; }
.hex-col-group span { width: 24px; text-align: center; flex-shrink: 0; }
.hex-byte    { width: 24px; text-align: center; flex-shrink: 0; }
.hex-space   { width: 6px; flex-shrink: 0; }

.byte-diff { color: var(--color-red); font-weight: 700; }
.ascii-left  { color: var(--color-red); }
.ascii-right { color: var(--color-green); }

/* Row colours */
.hex-add    { background: rgba(166,227,161,.07); }
.hex-del    { background: rgba(243,139,168,.07); }
.hex-diff   { background: rgba(249,226,175,.04); }
</style>
