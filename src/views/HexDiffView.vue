<script setup lang="ts">
import { ref, computed } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

const leftPath  = ref('')
const rightPath = ref('')
const leftBytes = ref<Uint8Array | null>(null)
const rightBytes = ref<Uint8Array | null>(null)
const error = ref('')
const BYTES_PER_LINE = 16

interface HexLine {
  offset: number
  left: number[] | null
  right: number[] | null
  leftascii: string
  rightascii: string
  changed: boolean
  leftonly: boolean
  rightonly: boolean
}

function toHexBytes(data: Uint8Array): HexLine[] {
  const lines: HexLine[] = []
  const maxLen = Math.max(data.length, 0)
  for (let i = 0; i < maxLen; i += BYTES_PER_LINE) {
    const left: number[] = []
    for (let j = 0; j < BYTES_PER_LINE; j++) {
      const b = i + j < data.length ? data[i + j] : -1
      left.push(b)
    }
    const ascii = left.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.').join('')
    lines.push({ offset: i, left, right: null, leftascii: ascii, rightascii: '', changed: false, leftonly: true, rightonly: false })
  }
  return lines
}

function diffHexLines(a: HexLine[], b: HexLine[]): HexLine[] {
  const result: HexLine[] = []
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i++) {
    const la = a[i]?.left ?? []
    const lb = b[i]?.left ?? []
    let changed = false
    for (let j = 0; j < BYTES_PER_LINE; j++) {
      if ((la[j] ?? -1) !== (lb[j] ?? -1)) { changed = true; break }
    }
    const lascii = la.map(b => b >= 0 && b < 127 ? String.fromCharCode(b) : b === -1 ? ' ' : '.').join('')
    const rascii = lb.map(b => b >= 0 && b < 127 ? String.fromCharCode(b) : b === -1 ? ' ' : '.').join('')
    result.push({
      offset: i * BYTES_PER_LINE,
      left: la.some(b => b >= 0) ? la : null,
      right: lb.some(b => b >= 0) ? lb : null,
      leftascii: lascii,
      rightascii: rascii,
      changed,
      leftonly: !b[i],
      rightonly: !a[i],
    })
  }
  return result
}

const lines = computed((): HexLine[] => {
  if (!leftBytes.value && !rightBytes.value) return []
  if (!leftBytes.value) return toHexBytes(rightBytes.value!)
  if (!rightBytes.value) return toHexBytes(leftBytes.value!)
  return diffHexLines(toHexBytes(leftBytes.value!), toHexBytes(rightBytes.value!))
})

const stats = computed(() => {
  let same = 0, diff = 0, leftOnly = 0, rightOnly = 0
  for (const l of lines.value) {
    if (l.rightonly) leftOnly++
    else if (l.leftonly) rightOnly++
    else if (l.changed) diff++
    else same++
  }
  return { same, diff, leftOnly, rightOnly }
})

async function loadFile(side: 'left' | 'right') {
  error.value = ''
  try {
    const path = await open({ multiple: false, title: `Select file (${side})` }) as string | null
    if (!path) return
    if (side === 'left') leftPath.value = path; else rightPath.value = path
    const bytes: number[] = await invoke('cmd_read_file_bytes', { path })
    const buf = new Uint8Array(bytes)
    if (side === 'left') leftBytes.value = buf; else rightBytes.value = buf
  } catch (e: any) { error.value = String(e) }
}

function fmtHex(byte: number): string {
  return byte < 0 ? '  ' : byte.toString(16).padStart(2, '0').toUpperCase()
}
function fmtOffset(n: number): string {
  return n.toString(16).padStart(8, '0').toUpperCase()
}
</script>

<template>
  <div class="hexdv">
    <div class="imgdv-crumb">
      <button class="crumb-home" @click="$router.push('/')">{{ $t('nav.home') }}</button>
      <span class="crumb-sep">›</span><span class="crumb-cur">Hex Compare</span>
    </div>

    <div class="hex-toolbar">
      <button class="tdv-btn-path" @click="loadFile('left')">
        <span class="tdv-lbl">LEFT</span>
        <span class="tdv-ptxt">{{ leftPath ? leftPath.split(/[/\\]/).pop() : 'Select…' }}</span>
      </button>
      <button class="tdv-btn-path" @click="loadFile('right')">
        <span class="tdv-lbl">RIGHT</span>
        <span class="tdv-ptxt">{{ rightPath ? rightPath.split(/[/\\]/).pop() : 'Select…' }}</span>
      </button>
      <div style="flex:1" />
      <span v-if="lines.length" class="hex-stat">
        <span class="s-eq">{{ stats.same }}</span>=
        <span class="s-mod">{{ stats.diff }}</span>~
        <span class="s-del">{{ stats.leftOnly }}</span>-
        <span class="s-add">{{ stats.rightOnly }}</span>+
      </span>
    </div>

    <div v-if="error" style="padding:8px 16px;background:rgba(239,68,68,.1);color:var(--color-red);font-size:12px">⚠ {{ error }}</div>

    <div class="hex-scroll" v-if="lines.length">
      <!-- Header -->
      <div class="hex-header">
        <div class="hex-off-hdr">Offset</div>
        <div class="hex-bytes-hdr">00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F</div>
        <div class="hex-asc-hdr">Decoded (ASCII)</div>
        <div class="hex-divider" />
        <div class="hex-off-hdr">Offset</div>
        <div class="hex-bytes-hdr">00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F</div>
        <div class="hex-asc-hdr">Decoded (ASCII)</div>
      </div>

      <!-- Rows -->
      <div class="hex-body">
        <template v-for="line in lines" :key="line.offset">
          <!-- Left pane -->
          <div class="hex-row" :class="{
            'hex-diff': line.changed,
            'hex-left-only': line.leftonly,
            'hex-right-only': line.rightonly && !line.left,
          }">
            <div class="hex-off">{{ fmtOffset(line.offset) }}</div>
            <div class="hex-bytes">
              <span v-for="(b, bi) in (line.left ?? [])" :key="bi"
                class="hex-byte" :class="{
                  'byte-diff': line.changed && line.right && fmtHex(b) !== fmtHex(line.right[bi] ?? -1),
                  'byte-del': line.leftonly,
                }">{{ fmtHex(b) }}</span>
              <span v-if="!line.left" class="hex-empty">—</span>
            </div>
            <div class="hex-ascii">{{ line.leftascii || ' ' }}</div>
          </div>
          <!-- Right pane -->
          <div class="hex-row" :class="{
            'hex-diff': line.changed,
            'hex-right-only': line.rightonly,
          }">
            <div class="hex-off">{{ fmtOffset(line.offset) }}</div>
            <div class="hex-bytes">
              <span v-for="(b, bi) in (line.right ?? [])" :key="bi"
                class="hex-byte" :class="{
                  'byte-diff': line.changed && line.left && fmtHex(b) !== fmtHex(line.left[bi] ?? -1),
                  'byte-add': line.rightonly,
                }">{{ fmtHex(b) }}</span>
              <span v-if="!line.right" class="hex-empty">—</span>
            </div>
            <div class="hex-ascii">{{ line.rightascii || ' ' }}</div>
          </div>
          <div class="hex-row-sep" />
        </template>
      </div>
    </div>

    <div v-else-if="!leftBytes && !rightBytes" class="hex-empty-state">
      <div style="font-size:48px">🔣</div>
      <div>Select two files to compare in hexadecimal</div>
    </div>
  </div>
</template>

<style scoped>
.hexdv { display:flex; flex-direction:column; height:100%; background:var(--color-bg) }
.imgdv-crumb { display:flex; align-items:center; gap:4px; padding:3px 16px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); font-size:11px }
.hex-toolbar { display:flex; align-items:center; gap:4px; padding:4px 8px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); min-height:38px; flex-wrap:wrap }
.hex-scroll { flex:1; overflow:auto; font-family: var(--font-mono); font-size: 12px; }
.hex-header { display:flex; position:sticky; top:0; z-index:5; background:var(--color-bg2); border-bottom:1px solid var(--color-border); padding:4px 0; font-weight:700; font-size:11px; color:var(--color-text-muted) }
.hex-row { display:flex; align-items:center; padding:2px 0; gap:0 }
.hex-row.hex-diff { background: rgba(59,130,246,.06) }
.hex-row.hex-left-only { background: rgba(239,68,68,.06) }
.hex-row.hex-right-only { background: rgba(34,197,94,.06) }
.hex-row-sep { border-bottom:1px solid var(--color-border); opacity:.3 }
.hex-off { width:70px; flex-shrink:0; padding:0 8px; color:var(--color-text-muted); font-size:11px }
.hex-bytes { display:flex; gap:3px; flex:1; min-width:0; flex-wrap:nowrap; overflow:hidden }
.hex-byte { display:inline-block; width:22px; text-align:center; flex-shrink:0 }
.byte-diff { color:var(--color-accent); font-weight:700 }
.byte-del { color:var(--color-red) }
.byte-add { color:var(--color-green) }
.hex-ascii { width:130px; flex-shrink:0; font-size:11px; color:var(--color-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-left:8px }
.hex-empty { color:var(--color-text-muted); opacity:.4 }
.hex-divider { width:1px; background:var(--color-border); margin:0 4px; flex-shrink:0 }
.hex-stat { font-size:12px; color:var(--color-text-muted); padding:0 8px }
.s-eq { color:var(--color-text-muted) }
.s-mod { color:var(--color-accent) }
.s-del { color:var(--color-red) }
.s-add { color:var(--color-green) }
.hex-off-hdr { width:70px; flex-shrink:0; padding:0 8px }
.hex-asc-hdr { width:130px; flex-shrink:0; padding-left:8px }
.hex-bytes-hdr { flex:1 }
.hex-empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--color-text-muted) }
.tdv-btn-path { display:flex; align-items:center; gap:4px; padding:4px 8px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:11px; cursor:pointer; max-width:180px; overflow:hidden }
.tdv-lbl { font-size:9px; font-weight:700; color:var(--color-text-muted); flex-shrink:0 }
.tdv-ptxt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px }
.tdv-btn-path:hover { border-color:var(--color-accent); color:var(--color-accent) }
</style>
