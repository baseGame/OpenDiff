<script setup lang="ts">
/**
 * ImageDiffView — Phase 3
 * Features: Pixel-level image diff, slider overlay, heatmap, threshold control
 */
import { ref, computed, onMounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

// ── State ──────────────────────────────────────────────────────────────
const leftPath   = ref('')
const rightPath  = ref('')
const leftUrl    = ref('')
const rightUrl   = ref('')
const diffUrl    = ref('')
const loading    = ref(false)
const error      = ref<string | null>(null)
const threshold  = ref(10) // pixel diff threshold
const diffMode   = ref<'side'|'overlay'|'heatmap'>('side')
const zoom       = ref(1)
const showDiff   = ref(true)

// ── Load ──────────────────────────────────────────────────────────────
async function pickFile(side: 'left' | 'right') {
  const path = await open({
    multiple: false,
    title: `Select ${side} image`,
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','bmp','webp','tiff'] }],
  }) as string | null
  if (!path) return
  if (side === 'left') leftPath.value = path
  else rightPath.value = path
  // Create object URLs for preview
  const { convertFileSrc } = await import('@tauri-apps/api/core')
  if (side === 'left') leftUrl.value  = convertFileSrc(path)
  else rightUrl.value = convertFileSrc(path)
  if (leftPath.value && rightPath.value) await computeDiff()
}

// ── Compute diff ──────────────────────────────────────────────────────
async function computeDiff() {
  if (!leftPath.value || !rightPath.value) return
  loading.value = true
  error.value = null
  try {
    const result: string = await invoke('cmd_diff_images', {
      leftPath: leftPath.value,
      rightPath: rightPath.value,
      threshold: threshold.value,
    })
    diffUrl.value = result
  } catch (e: any) {
    // Fallback: compute diff in browser using canvas
    await computeDiffBrowser()
  } finally {
    loading.value = false
  }
}

async function computeDiffBrowser() {
  try {
    const [lImg, rImg] = await Promise.all([
      loadImage(leftUrl.value),
      loadImage(rightUrl.value),
    ])

    const w = Math.max(lImg.width, rImg.width)
    const h = Math.max(lImg.height, rImg.height)

    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!

    // Draw left
    ctx.drawImage(lImg, 0, 0)
    const leftData = ctx.getImageData(0, 0, w, h)

    // Draw right
    ctx.drawImage(rImg, 0, 0)
    const rightData = ctx.getImageData(0, 0, w, h)

    // Compute diff
    const diffData = ctx.createImageData(w, h)
    for (let i = 0; i < diffData.data.length; i += 4) {
      const dr = Math.abs(leftData.data[i]   - rightData.data[i])
      const dg = Math.abs(leftData.data[i+1] - rightData.data[i+1])
      const db = Math.abs(leftData.data[i+2] - rightData.data[i+2])
      const da = Math.abs(leftData.data[i+3] - rightData.data[i+3])
      const total = dr + dg + db
      if (total > threshold.value * 3) {
        // Highlight diff in red/green
        diffData.data[i]   = Math.min(255, dr * 4)
        diffData.data[i+1] = Math.min(255, dg * 4)
        diffData.data[i+2] = Math.min(255, db * 4)
        diffData.data[i+3] = 200
      } else {
        diffData.data[i] = diffData.data[i+1] = diffData.data[i+2] = 0
        diffData.data[i+3] = 0
      }
    }
    ctx.putImageData(diffData, 0, 0)
    diffUrl.value = canvas.toDataURL('image/png')
  } catch (e: any) {
    error.value = `无法计算图片差异: ${e}`
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ── Zoom ──────────────────────────────────────────────────────────────
function zoomIn()  { zoom.value = Math.min(4, zoom.value * 1.5) }
function zoomOut() { zoom.value = Math.max(0.25, zoom.value / 1.5) }
function zoomFit() { zoom.value = 1 }

// ── Overlay slider ───────────────────────────────────────────────────
const overlayPos = ref(50)

onMounted(async () => {
  if (leftPath.value && rightPath.value) await computeDiff()
})
</script>

<template>
  <div class="image-diff-view flex flex-col h-full overflow-hidden">

    <!-- Toolbar -->
    <div class="img-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="pickFile('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftPath || 'Open image…' }}</span>
      </button>

      <div class="flex items-center gap-1 flex-shrink-0">
        <button class="btn btn-icon" @click="zoomOut">−</button>
        <span class="text-xs text-muted">{{ Math.round(zoom * 100) }}%</span>
        <button class="btn btn-icon" @click="zoomIn">+</button>
        <button class="btn btn-icon" @click="zoomFit">⊡</button>
      </div>

      <div class="flex items-center gap-1 flex-shrink-0">
        <button
          v-for="m in ['side','overlay','heatmap']" :key="m"
          class="btn btn-icon"
          :class="{ active: diffMode === m }"
          @click="diffMode = m as any"
        >{{ { side:'◫', overlay:'⊟', heatmap:'🎨' }[m] }}</button>
        <label class="flex items-center gap-1 text-xs text-muted ml-2">
          <span>Threshold:</span>
          <input type="range" v-model.number="threshold" min="0" max="100" style="width:80px"
            @change="computeDiff" />
          <span>{{ threshold }}</span>
        </label>
        <button v-if="diffUrl" class="btn btn-icon" @click="showDiff = !showDiff">
          {{ showDiff ? '👁' : '🙈' }}
        </button>
      </div>

      <button class="path-btn btn" @click="pickFile('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightPath || 'Open image…' }}</span>
      </button>
    </div>

    <!-- Status -->
    <div v-if="loading" class="diff-status loading">⟳ Computing pixel diff…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Image area -->
    <div v-if="leftUrl || rightUrl" class="img-main flex-1 overflow-auto">

      <!-- Side-by-side -->
      <div v-if="diffMode === 'side'" class="side-view flex h-full">
        <div class="img-pane flex-1 overflow-hidden" :style="`transform:scale(${zoom})`">
          <img v-if="leftUrl" :src="leftUrl" class="max-w-none" />
        </div>
        <div class="img-divider" />
        <div class="img-pane flex-1 overflow-hidden" :style="`transform:scale(${zoom})`">
          <img v-if="rightUrl" :src="rightUrl" class="max-w-none" />
        </div>
        <!-- Diff overlay -->
        <div v-if="showDiff && diffUrl" class="diff-overlay">
          <img :src="diffUrl" />
        </div>
      </div>

      <!-- Overlay slider -->
      <div v-else-if="diffMode === 'overlay'" class="overlay-view relative overflow-hidden">
        <img :src="rightUrl" class="max-w-none" :style="`transform:scale(${zoom})`" />
        <div
          class="overlay-clip absolute top-0 left-0 h-full overflow-hidden"
          :style="`width: ${overlayPos}%`"
        >
          <img :src="leftUrl" class="max-w-none" :style="`transform:scale(${zoom})`" />
        </div>
        <div
          class="overlay-slider absolute top-0 h-full w-1 bg-white shadow-lg cursor-ew-resize"
          :style="`left: ${overlayPos}%`"
        >
          <div class="slider-handle">◀▶</div>
        </div>
        <input
          type="range" class="overlay-range absolute bottom-2 w-full"
          v-model.number="overlayPos" min="0" max="100"
        />
      </div>

      <!-- Heatmap -->
      <div v-else class="heatmap-view flex items-center justify-center">
        <img v-if="diffUrl" :src="diffUrl" :style="`transform:scale(${zoom})`" class="diff-heatmap" />
      </div>

    </div>

    <!-- Empty state -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-muted text-center">
        <div class="text-4xl mb-4">🖼️</div>
        <div>请选择两张图片开始像素级对比</div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.image-diff-view { background: var(--color-bg2); }

.img-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0; min-height: 38px;
}
.path-btn { flex: 1; min-width: 0; font-family: var(--font-mono); font-size: 12px; }

.diff-status {
  padding: 5px 14px; font-size: 12px; flex-shrink: 0; border-bottom: 1px solid var(--color-border);
}
.diff-status.loading { color: var(--color-accent); }
.diff-status.error   { color: var(--color-red); }

.img-main { overflow: auto; }

/* Side-by-side */
.side-view { position: relative; }
.img-pane  { display: flex; align-items: flex-start; justify-content: flex-start; }
.img-pane img { display: block; }
.img-divider { width: 4px; background: var(--color-border); flex-shrink: 0; }
.diff-overlay {
  position: absolute; top: 0; left: 0; width: 50%;
  pointer-events: none; opacity: .6; mix-blend-mode: multiply;
}
.diff-overlay img { width: 100%; display: block; }

/* Overlay */
.overlay-view { cursor: ew-resize; }
.overlay-clip { clip-path: inset(0); }
.overlay-slider {
  transform: translateX(-50%);
  display: flex; align-items: center; justify-content: center;
}
.slider-handle {
  background: rgba(255,255,255,.9); padding: 4px 6px;
  border-radius: 8px; font-size: 12px; color: #333;
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
.overlay-range { opacity: 0; height: 0; }

/* Heatmap */
.heatmap-view { padding: 20px; }
.diff-heatmap { max-width: 100%; }

/* Zoom */
img { transition: transform .1s; }
</style>
