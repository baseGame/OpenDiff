<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { LOCALES, type LocaleCode } from '@/i18n'
import { Save, RotateCcw, Monitor, Moon, Sun } from 'lucide-vue-next'

const store = useSettingsStore()
const saving = ref(false)
const saveMsg = ref('')

const themeOptions = [
  { labelKey: 'settings.theme_auto', value: 'auto', icon: Monitor },
  { labelKey: 'settings.theme_dark', value: 'dark', icon: Moon },
  { labelKey: 'settings.theme_light', value: 'light', icon: Sun },
]

const algoOptions = [
  { labelKey: 'settings.algo_myers', value: 'myers' },
  { labelKey: 'settings.algo_patience', value: 'patience' },
  { labelKey: 'settings.algo_histogram', value: 'histogram' },
]

const fontOptions = [
  'JetBrains Mono', 'Cascadia Code', 'Consolas', 'Fira Code',
  'Source Code Pro', 'Ubuntu Mono', 'monospace',
]

const shortcutRows = [
  { key: 'Ctrl + O', descKey: 'settings.shortcut_open_left' },
  { key: 'Ctrl + Shift + O', descKey: 'settings.shortcut_open_right' },
  { key: 'Ctrl + ,', descKey: 'settings.shortcut_settings' },
  { key: 'F7', descKey: 'settings.shortcut_prev' },
  { key: 'F8', descKey: 'settings.shortcut_next' },
  { key: 'Escape', descKey: 'settings.shortcut_close' },
  { key: '?', descKey: 'settings.shortcut_help' },
]

const formatExts = ref([
  { ext: 'py',   mode: 'text' },
  { ext: 'js',   mode: 'text' },
  { ext: 'ts',   mode: 'text' },
  { ext: 'tsx',  mode: 'text' },
  { ext: 'jsx',  mode: 'text' },
  { ext: 'c',    mode: 'text' },
  { ext: 'cpp',  mode: 'text' },
  { ext: 'h',    mode: 'text' },
  { ext: 'java', mode: 'text' },
  { ext: 'go',   mode: 'text' },
  { ext: 'rs',   mode: 'text' },
  { ext: 'cs',   mode: 'text' },
  { ext: 'rb',   mode: 'text' },
  { ext: 'php',  mode: 'text' },
  { ext: 'swift', mode: 'text' },
  { ext: 'kt',   mode: 'text' },
  { ext: 'sql',  mode: 'text' },
  { ext: 'sh',   mode: 'text' },
  { ext: 'bash', mode: 'text' },
  { ext: 'md',   mode: 'text' },
  { ext: 'json', mode: 'text' },
  { ext: 'yaml', mode: 'text' },
  { ext: 'yml',  mode: 'text' },
  { ext: 'xml',  mode: 'text' },
  { ext: 'csv',  mode: 'table' },
  { ext: 'tsv',  mode: 'table' },
  { ext: 'xlsx', mode: 'table' },
  { ext: 'xls',  mode: 'table' },
  { ext: 'png',  mode: 'image' },
  { ext: 'jpg',  mode: 'image' },
  { ext: 'jpeg', mode: 'image' },
  { ext: 'gif',  mode: 'image' },
  { ext: 'webp', mode: 'image' },
  { ext: 'bmp',  mode: 'image' },
])

function saveFormats() {
  localStorage.setItem('formatAssociations', JSON.stringify(formatExts.value))
  // format associations saved to localStorage
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem('formatAssociations') || '[]')
    if (saved.length) formatExts.value = saved
  } catch {}
})

async function saveSettings() {
  saving.value = true
  saveMsg.value = ''
  try {
    await store.save()
    saveMsg.value = 'saved'
    setTimeout(() => { saveMsg.value = '' }, 2000)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (!store.loaded) store.load()
})
</script>

<template>
  <div class="settings-view">
    <div class="settings-header">
      <h2>⚙️ {{ $t('settings.title') }}</h2>
      <p class="desc">{{ $t('settings.desc') }}</p>
    </div>

    <div class="settings-body">

      <!-- Appearance -->
      <section class="settings-section">
        <h3 class="section-title">{{ $t('settings.appearance') }}</h3>

        <!-- Language -->
        <div class="setting-row">
          <div class="setting-info">
            <label>{{ $t('settings.language') }}</label>
            <span class="setting-desc">选择界面显示语言</span>
          </div>
          <select
            :value="store.settings.language"
            class="setting-select"
            @change="store.settings.language = ($event.target as HTMLSelectElement).value; store.save()"
          >
            <option v-for="loc in LOCALES" :key="loc.code" :value="loc.code">
              {{ loc.labelNative }}
            </option>
          </select>
        </div>

        <!-- Theme -->
        <div class="setting-row">
          <div class="setting-info">
            <label>{{ $t('settings.theme') }}</label>
            <span class="setting-desc">选择深色 / 浅色 / 自动主题</span>
          </div>
          <div class="theme-group">
            <button
              v-for="opt in themeOptions"
              :key="opt.value"
              class="theme-btn"
              :class="{ active: store.settings.theme === opt.value }"
              @click="store.settings.theme = opt.value as any; store.save()"
            >
              <component :is="opt.icon" :size="15" />
              {{ $t(opt.labelKey) }}
            </button>
          </div>
        </div>

        <!-- Font -->
        <div class="setting-row">
          <div class="setting-info">
            <label>{{ $t('settings.font_family') }}</label>
            <span class="setting-desc">代码显示字体</span>
          </div>
          <select v-model="store.settings.font_family" class="setting-select" @change="store.save()">
            <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>

        <!-- Font Size -->
        <div class="setting-row">
          <div class="setting-info">
            <label>{{ $t('settings.font_size') }} — {{ store.settings.font_size }}px</label>
            <span class="setting-desc">编辑器基准字号</span>
          </div>
          <div class="range-row">
            <span class="range-label">10</span>
            <input
              :value="store.settings.font_size"
              @input="store.settings.font_size = Number(($event.target as HTMLInputElement).value)"
              @change="store.save()"
              type="range" min="10" max="24" step="1" class="range-input"
            />
            <span class="range-label">24</span>
            <span class="font-preview" :style="{ fontSize: store.settings.font_size + 'px' }">Aa</span>
          </div>
        </div>
      </section>

      <!-- Diff Engine -->
      <section class="settings-section">
        <h3 class="section-title">{{ $t('settings.diff_engine') }}</h3>

        <div class="setting-row">
          <div class="setting-info">
            <label>{{ $t('settings.algorithm') }}</label>
            <span class="setting-desc">影响差异计算速度与质量</span>
          </div>
          <select v-model="store.settings.diff_algorithm" class="setting-select" @change="store.save()">
            <option v-for="o in algoOptions" :key="o.value" :value="o.value">{{ $t(o.labelKey) }}</option>
          </select>
        </div>

        <div class="setting-row">
          <div class="setting-info"><label>{{ $t('settings.show_line_numbers') }}</label></div>
          <label class="toggle">
            <input v-model="store.settings.show_line_numbers" type="checkbox" @change="store.save()" />
            <span class="toggle-slider" />
          </label>
        </div>

        <div class="setting-row">
          <div class="setting-info"><label>{{ $t('settings.word_wrap') }}</label></div>
          <label class="toggle">
            <input v-model="store.settings.word_wrap" type="checkbox" @change="store.save()" />
            <span class="toggle-slider" />
          </label>
        </div>
      </section>

      <!-- Sessions -->
      <section class="settings-section">
        <h3 class="section-title">{{ $t('settings.sessions') }}</h3>
        <div class="setting-row">
          <div class="setting-info"><label>{{ $t('settings.auto_save') }}</label></div>
          <label class="toggle">
            <input v-model="store.settings.auto_save_sessions" type="checkbox" @change="store.save()" />
            <span class="toggle-slider" />
          </label>
        </div>
      </section>

      <!-- Format Associations -->
      <section class="settings-section">
        <h3 class="section-title">{{ $t('settings.format_associations') || '文件格式关联' }}</h3>
        <div class="setting-desc" style="margin-bottom:12px">选择文件打开时的默认对比模式</div>
        <div class="format-grid">
          <div v-for="ext in formatExts" :key="ext.ext" class="format-row">
            <span class="format-ext">.{{ ext.ext }}</span>
            <select v-model="ext.mode" class="setting-select" style="width:140px" @change="saveFormats">
              <option value="text">文本对比</option>
              <option value="table">表格对比</option>
              <option value="hex">十六进制</option>
              <option value="image">图片对比</option>
              <option value="auto">自动检测</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Shortcuts -->
      <section class="settings-section">
        <h3 class="section-title">{{ $t('settings.shortcuts') }}</h3>
        <div class="shortcuts-grid">
          <div v-for="s in shortcutRows" :key="s.key" class="shortcut-row">
            <kbd>{{ s.key }}</kbd>
            <span>{{ $t(s.descKey) }}</span>
          </div>
        </div>
      </section>

      <!-- About -->
      <section class="settings-section">
        <h3 class="section-title">{{ $t('settings.about') }}</h3>
        <div class="about-box">
          <div class="about-name">OpenDiff</div>
          <div class="about-version">{{ $t('settings.version') }} 0.2.3</div>
          <div class="about-desc">Beyond Compare · 开源替代</div>
          <div class="about-links">
            <a href="https://github.com/baseGame/OpenDiff" target="_blank" rel="noopener">GitHub</a>
            <span>·</span>
            <a href="https://github.com/baseGame/OpenDiff/releases" target="_blank" rel="noopener">{{ $t('settings.releases') }}</a>
          </div>
        </div>
      </section>

    </div>

    <div class="settings-footer">
      <button class="btn-ghost" @click="store.resetDefaults(); store.save()">
        <RotateCcw :size="14" /> {{ $t('settings.reset') }}
      </button>
      <button class="btn-primary" @click="saveSettings">
        <Save :size="14" />
        {{ saveMsg === 'saved' ? '✓ ' + $t('settings.saved') : $t('settings.save') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.settings-view { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.settings-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--color-border); flex-shrink: 0; }
.settings-header h2 { font-size: 18px; font-weight: 700; margin: 0 0 4px; }
.desc { color: var(--color-text-muted); font-size: 13px; margin: 0; }
.settings-body { flex: 1; overflow-y: auto; padding: 0 0 80px; }
.settings-section { padding: 16px 24px; border-bottom: 1px solid var(--color-border); }
.section-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin: 0 0 12px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 0; }
.setting-info { flex: 1; min-width: 0; }
.setting-info label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 2px; }
.setting-desc { font-size: 12px; color: var(--color-text-muted); }
.theme-group { display: flex; gap: 6px; }
.theme-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-secondary); font-size: 12px; cursor: pointer; transition: all 0.15s; }
.theme-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.theme-btn.active { border-color: var(--color-accent); background: var(--color-accent); color: #fff; }
.setting-select { padding: 5px 10px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text); font-size: 13px; min-width: 180px; max-width: 220px; cursor: pointer; }
.range-row { display: flex; align-items: center; gap: 8px; }
.range-label { font-size: 11px; color: var(--color-text-muted); width: 20px; text-align: center; }
.range-input { width: 140px; accent-color: var(--color-accent); cursor: pointer; }
.font-preview { font-family: var(--font-mono, monospace); color: var(--color-accent); width: 36px; text-align: center; border: 1px solid var(--color-border); border-radius: 4px; padding: 2px 4px; background: var(--color-surface); }
.toggle { position: relative; display: inline-block; width: 38px; height: 22px; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider { position: absolute; inset: 0; background: var(--color-border); border-radius: 11px; transition: 0.2s; }
.toggle-slider::before { content: ''; position: absolute; width: 16px; height: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.2s; }
.toggle input:checked + .toggle-slider { background: var(--color-accent); }
.toggle input:checked + .toggle-slider::before { transform: translateX(16px); }
.shortcuts-grid { display: flex; flex-direction: column; gap: 6px; }
.shortcut-row { display: flex; align-items: center; gap: 12px; font-size: 12px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.shortcut-row:last-child { border-bottom: none; }
kbd { min-width: 170px; padding: 3px 8px; border-radius: 5px; background: var(--color-bg3); border: 1px solid var(--color-border); font-family: var(--font-mono, monospace); font-size: 11px; color: var(--color-accent); text-align: center; }
.about-box { padding: 12px; background: var(--color-surface); border-radius: 8px; border: 1px solid var(--color-border); }
.about-name { font-size: 15px; font-weight: 600; }
.about-version { font-size: 12px; color: var(--color-text-muted); margin: 2px 0; }
.about-desc { font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px; }
.about-links { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.about-links a { color: var(--color-accent); text-decoration: none; }
.about-links a:hover { text-decoration: underline; }
.settings-footer { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 24px; background: var(--color-bg2); border-top: 1px solid var(--color-border); }
.btn-ghost { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 6px; border: 1px solid var(--color-border); background: transparent; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; }
.btn-ghost:hover { border-color: var(--color-accent); color: var(--color-accent); }
.btn-primary { display: flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 6px; border: none; background: var(--color-accent); color: white; font-size: 13px; cursor: pointer; font-weight: 500; }
.btn-primary:hover { opacity: 0.9; }
.format-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 4px; }
.format-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 12px; }
.format-ext { font-family: monospace; font-weight: 600; color: var(--color-text-secondary); min-width: 36px; }
</style>
