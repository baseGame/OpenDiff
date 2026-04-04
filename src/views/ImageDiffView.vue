<script setup lang="ts">
import { ref } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

const leftPath  = ref('')
const rightPath = ref('')
const leftImg   = ref<HTMLImageElement | null>(null)
const rightImg  = ref<HTMLImageElement | null>(null)
const diffPct   = ref('')
const loading   = ref(false)
const error     = ref('')
const alphaSensitive = ref(false)

async function loadImage(side: 'left' | 'right') {
  try {
    const path = await open({ multiple: false, title: `Select image (${side})` }) as string | null
    if (!path) return
    if (side === 'left') leftPath.value = path; else rightPath.value = path
    const dataUrl: string = await invoke('cmd_read_file_base64', { path })
    const img = new Image()
    img.src = dataUrl
    img.onload = () => {
      if (side === 'left') leftImg.value = img; else rightImg.value = img
      computeDiff()
    }
    img.onerror = () => { error.value = 'Cannot decode image: ' + path }
  } catch (e: any) { error.value = String(e) }
}

function computeDiff() {
  if (!leftImg.value || !rightImg.value) return
  const l = leftImg.value, r = rightImg.value
  if (l.width !== r.width || l.height !== r.height) { diffPct.value = 'N/A (size mismatch)'; return }
  loading.value = true
  setTimeout(() => {
    const w = l.width, h = l.height
    const oc = document.createElement('canvas'); oc.width = w; oc.height = h
    const rc = document.createElement('canvas'); rc.width = w; rc.height = h
    const od = oc.getContext('2d')!; od.drawImage(l, 0, 0)
    const rd = rc.getContext('2d')!; rd.drawImage(r, 0, 0)
    const o = od.getImageData(0, 0, w, h).data
    const R = rd.getImageData(0, 0, w, h).data
    let diff = 0, total = w * h, ch = alphaSensitive.value ? 4 : 3
    for (let i = 0; i < o.length; i += 4)
      if (Math.abs(o[i] - R[i]) > 2 || Math.abs(o[i+1] - R[i+1]) > 2 || Math.abs(o[i+2] - R[i+2]) > 2 ||
         (alphaSensitive.value && Math.abs(o[i+3] - R[i+3]) > 2)) diff++
    diffPct.value = ((diff / (total * ch)) * 100).toFixed(2) + '%'
    loading.value = false
  }, 50)
}
</script>

<template>
  <div class="imgdv">
    <div class="imgdv-crumb">
      <button class="crumb-home" @click="$router.push('/')">{{ $t('nav.home') }}</button>
      <span class="crumb-sep">›</span><span class="crumb-cur">Image Compare</span>
    </div>

    <div class="imgdv-toolbar">
      <button class="tdv-btn-path" @click="loadImage('left')">
        <span class="tdv-lbl">LEFT</span>
        <span class="tdv-ptxt">{{ leftPath ? leftPath.split(/[/\\]/).pop() : 'Select…' }}</span>
      </button>
      <button class="tdv-btn-path" @click="loadImage('right')">
        <span class="tdv-lbl">RIGHT</span>
        <span class="tdv-ptxt">{{ rightPath ? rightPath.split(/[/\\]/).pop() : 'Select…' }}</span>
      </button>
      <div style="flex:1" />
      <label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;color:var(--color-text)">
        <input type="checkbox" v-model="alphaSensitive" @change="computeDiff" /> Alpha channel
      </label>
      <span v-if="diffPct" class="imgdv-stat">
        <span class="s-mod">{{ diffPct }}</span> pixels differ
      </span>
    </div>

    <div v-if="error" style="padding:8px 16px;background:rgba(239,68,68,.1);color:var(--color-red);font-size:12px">⚠ {{ error }}</div>
    <div v-if="loading" style="padding:8px 16px;background:rgba(59,130,246,.1);color:var(--color-accent);font-size:12px">⚙ Computing pixel diff…</div>

    <div class="imgdv-area" v-if="leftImg && rightImg">
      <div class="imgdv-pane">
        <img :src="leftImg.src" class="imgdv-img" alt="Left" />
        <div class="imgdv-badge">LEFT</div>
      </div>
      <div class="imgdv-pane">
        <img :src="rightImg.src" class="imgdv-img" alt="Right" />
        <div class="imgdv-badge">RIGHT</div>
      </div>
    </div>
    <div v-else-if="!leftImg && !rightImg" class="imgdv-empty">
      <div style="font-size:56px">🖼</div>
      <div style="font-size:14px">Select two images to compare — differences are highlighted</div>
    </div>
  </div>
</template>

<style scoped>
.imgdv { display:flex; flex-direction:column; height:100%; background:var(--color-bg) }
.imgdv-crumb { display:flex; align-items:center; gap:4px; padding:3px 16px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); font-size:11px }
.imgdv-toolbar { display:flex; align-items:center; gap:4px; padding:4px 8px; background:var(--color-bg2); border-bottom:1px solid var(--color-border); min-height:38px; flex-wrap:wrap }
.imgdv-area { flex:1; display:flex; overflow:auto; padding:16px; gap:8px; align-items:flex-start; justify-content:center }
.imgdv-pane { position:relative; flex:1; max-width:calc(50% - 8px) }
.imgdv-img { max-width:100%; height:auto; display:block; border-radius:6px; border:1px solid var(--color-border) }
.imgdv-badge { position:absolute; top:8px; left:8px; background:rgba(0,0,0,.65); color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700 }
.imgdv-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--color-text-muted) }
.imgdv-stat { font-size:12px; color:var(--color-text-muted); padding:0 8px }
.tdv-btn-path { display:flex; align-items:center; gap:4px; padding:4px 8px; border:1px solid var(--color-border); border-radius:6px; background:var(--color-surface); color:var(--color-text); font-size:11px; cursor:pointer; max-width:180px; overflow:hidden }
.tdv-lbl { font-size:9px; font-weight:700; color:var(--color-text-muted); flex-shrink:0 }
.tdv-ptxt { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px }
.tdv-btn-path:hover { border-color:var(--color-accent); color:var(--color-accent) }
</style>
