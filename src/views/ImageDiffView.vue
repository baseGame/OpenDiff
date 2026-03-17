<script setup lang="ts">
/**
 * ImageDiffView — Phase 3
 * Pixel-level image comparison with overlay modes
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useTabStore } from '@/stores/tabs'
import { open } from '@tauri-apps/plugin-dialog'

const tabStore  = useTabStore()
const activeTab = computed(() => tabStore.activeTab)

const leftPath  = ref('')
const rightPath = ref('')
const leftSrc   = ref('')
const rightSrc  = ref('')
const mode = ref<'side-by-side' | 'overlay' | 'diff'>('side-by-side')
const tolerance = ref(10)
const zoom = ref(1.0)
const loading = ref(false)
const error   = ref<string | null>(null)

// Canvas refs for diff rendering
const diffCanvas = ref<HTMLCanvasElement | null>(null)

async function loadImage(side: 'left' | 'right') {
  const path = await open({
    multiple: false,
    title: `Select ${side} image`,
    filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','bmp','gif','webp','ico','tiff'] }]
  }) as string | null
  if (!path) return
  // Use file:// URL for Tauri
  const src = `asset://localhost/${encodeURIComponent(path.replace(/\\/g, '/').replace(/^\//, ''))}`
  if (side === 'left')  { leftPath.value  = path; leftSrc.value  = `file://${path}` }
  else                  { rightPath.value = path; rightSrc.value = `file://${path}` }
  if (mode.value === 'diff' && leftSrc.value && rightSrc.value) computeDiff()
}

async function computeDiff() {
  if (!diffCanvas.value || !leftSrc.value || !rightSrc.value) return
  loading.value = true
  const canvas = diffCanvas.value
  const ctx = canvas.getContext('2d')!
  try {
    const [imgL, imgR] = await Promise.all([
      loadImg(leftSrc.value),
      loadImg(rightSrc.value),
    ])
    const w = Math.max(imgL.width, imgR.width)
    const h = Math.max(imgL.height, imgR.height)
    canvas.width = w; canvas.height = h
    ctx.drawImage(imgL, 0, 0)
    const dL = ctx.getImageData(0, 0, w, h)
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(imgR, 0, 0)
    const dR = ctx.getImageData(0, 0, w, h)
    const out = ctx.createImageData(w, h)
    let diffPx = 0
    for (let i = 0; i < dL.data.length; i += 4) {
      const dr = Math.abs(dL.data[i]   - dR.data[i])
      const dg = Math.abs(dL.data[i+1] - dR.data[i+1])
      const db = Math.abs(dL.data[i+2] - dR.data[i+2])
      const delta = (dr + dg + db) / 3
      if (delta > tolerance.value) {
        // Highlight diff in red
        out.data[i]   = 220; out.data[i+1] = 50; out.data[i+2] = 80; out.data[i+3] = 220
        diffPx++
      } else {
        // Grey out same pixels
        const avg = (dL.data[i] + dL.data[i+1] + dL.data[i+2]) / 3
        out.data[i] = out.data[i+1] = out.data[i+2] = avg * 0.4
        out.data[i+3] = 160
      }
    }
    ctx.putImageData(out, 0, 0)
    diffPixels.value = diffPx
    totalPixels.value = (w * h)
  } catch (e: any) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const diffPixels  = ref(0)
const totalPixels = ref(0)
const diffPct = computed(() => totalPixels.value ? ((diffPixels.value / totalPixels.value) * 100).toFixed(2) : '0')

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Cannot load image: ${src}`))
    img.src = src
  })
}

watch(mode, (m) => { if (m === 'diff') computeDiff() })
watch(tolerance, () => { if (mode.value === 'diff') computeDiff() })
</script>

<template>
  <div class="image-diff-view flex flex-col h-full overflow-hidden">
    <!-- Toolbar -->
    <div class="img-toolbar flex items-center gap-2">
      <button class="path-btn btn" @click="loadImage('left')">
        <span class="text-muted text-xs">LEFT</span>
        <span class="truncate">{{ leftPath || 'Open image…' }}</span>
      </button>
      <div class="flex items-center gap-2 flex-shrink-0">
        <select class="input" style="width:130px" v-model="mode">
          <option value="side-by-side">并排对比</option>
          <option value="overlay">叠加对比</option>
          <option value="diff">差异高亮</option>
        </select>
        <label class="text-xs text-muted">容差:</label>
        <input type="range" v-model="tolerance" min="0" max="100" style="width:80px" />
        <span class="text-xs text-muted">{{ tolerance }}</span>
        <label class="text-xs text-muted">缩放:</label>
        <select class="input" style="width:70px" v-model="zoom">
          <option :value="0.25">25%</option>
          <option :value="0.5">50%</option>
          <option :value="1">100%</option>
          <option :value="2">200%</option>
        </select>
      </div>
      <button class="path-btn btn" @click="loadImage('right')">
        <span class="text-muted text-xs">RIGHT</span>
        <span class="truncate">{{ rightPath || 'Open image…' }}</span>
      </button>
    </div>

    <!-- Stats -->
    <div v-if="mode === 'diff' && totalPixels" class="stats-bar flex items-center gap-3">
      <span class="text-xs text-muted">差异像素: <strong class="text-red">{{ diffPixels.toLocaleString() }}</strong></span>
      <span class="text-xs text-muted">总像素: {{ totalPixels.toLocaleString() }}</span>
      <span class="badge" :class="diffPixels ? 'badge-del' : 'badge-add'">{{ diffPct }}% diff</span>
    </div>

    <div v-if="loading" class="diff-status loading">⟳ Computing pixel diff…</div>
    <div v-else-if="error" class="diff-status error">⚠ {{ error }}</div>

    <!-- Image area -->
    <div class="img-main flex-1 overflow-auto">
      <!-- Side by side -->
      <div v-if="mode === 'side-by-side'" class="side-by-side flex h-full gap-0">
        <div class="img-pane flex-1 overflow-auto">
          <img v-if="leftSrc" :src="leftSrc" :style="`transform: scale(${zoom}); transform-origin: top left`" />
          <div v-else class="img-placeholder text-muted">左侧图片</div>
        </div>
        <div class="divider divider-v" />
        <div class="img-pane flex-1 overflow-auto">
          <img v-if="rightSrc" :src="rightSrc" :style="`transform: scale(${zoom}); transform-origin: top left`" />
          <div v-else class="img-placeholder text-muted">右侧图片</div>
        </div>
      </div>

      <!-- Overlay -->
      <div v-else-if="mode === 'overlay'" class="overlay-wrap overflow-auto">
        <div class="overlay-stack" :style="`transform: scale(${zoom}); transform-origin: top left`">
          <img v-if="leftSrc"  :src="leftSrc"  class="overlay-img" style="opacity:0.5" />
          <img v-if="rightSrc" :src="rightSrc" class="overlay-img overlay-right" style="opacity:0.5;mix-blend-mode:difference" />
        </div>
      </div>

      <!-- Diff canvas -->
      <div v-else class="diff-wrap overflow-auto">
        <canvas ref="diffCanvas" :style="`transform: scale(${zoom}); transform-origin: top left`" />
        <div v-if="!leftSrc || !rightSrc" class="img-placeholder text-muted">请先打开两张图片</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-diff-view { background: var(--color-bg3); }
.img-toolbar {
  background: var(--color-bg2); border-bottom: 1px solid var(--color-border);
  padding: 5px 8px; flex-shrink: 0;
}
.path-btn { flex: 1; min-width: 0; font-size: 12px; }
.stats-bar { background: var(--color-bg3); border-bottom: 1px solid var(--color-border); padding: 4px 12px; flex-shrink: 0; }
.diff-status { padding: 5px 14px; font-size: 12px; flex-shrink: 0; border-bottom: 1px solid var(--color-border); }
.diff-status.loading { color: var(--color-accent); }
.diff-status.error   { color: var(--color-red); }
.img-main { background: rgba(0,0,0,.3); }
.side-by-side { background: rgba(0,0,0,.2); }
.img-pane { padding: 16px; display: flex; justify-content: flex-start; align-items: flex-start; }
.img-pane img { max-width: none; border: 1px solid var(--color-border); box-shadow: 0 4px 20px rgba(0,0,0,.4); }
.img-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 200px; font-size: 14px; }
.overlay-wrap { padding: 16px; }
.overlay-stack { position: relative; display: inline-block; }
.overlay-img { display: block; }
.overlay-right { position: absolute; top: 0; left: 0; }
.diff-wrap { padding: 16px; }
.diff-wrap canvas { border: 1px solid var(--color-border); }
.badge-add { background: rgba(166,227,161,.2); color: var(--color-green); display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.badge-del { background: rgba(243,139,168,.2); color: var(--color-red); display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
</style>
