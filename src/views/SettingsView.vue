<script setup lang="ts">
/**
 * SettingsView — App preferences and configuration
 * Connected to Rust backend via useSettingsStore
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import type { AppSettings, ThemeMode } from '@/types'
import { Save, RotateCcw, Monitor, Moon, Sun, Laptop } from 'lucide-vue-next'

const store = useSettingsStore()
const saved = ref(false)
const saving = ref(false)
const saveMsg = computed(() => saving.value ? 'Saving…' : saved.value ? '✓ Saved!' : 'Save Settings')

const themeOptions: { label: string; value: ThemeMode; icon: any }[] = [
  { label: 'Auto (System)', value: 'auto', icon: Monitor },
  { label: 'Dark', value: 'dark', icon: Moon },
  { label: 'Light', value: 'light', icon: Sun },
]

const algoOptions = [
  { label: 'Myers (Default)', value: 'myers' },
  { label: 'Patience (Stable)', value: 'patience' },
  { label: 'Histogram (Fast)', value: 'histogram' },
]

const fontOptions = [
  'JetBrains Mono',
  'Cascadia Code',
  'Consolas',
  'Fira Code',
  'Source Code Pro',
  'Ubuntu Mono',
  'monospace',
]

async function saveSettings() {
  saving.value = true
  saved.value = false
  try {
    await store.save()
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } finally {
    saving.value = false
  }
}

function resetDefaults() {
  store.settings = {
    theme: 'auto',
    font_family: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    font_size: 13,
    diff_algorithm: 'histogram',
    show_line_numbers: true,
    show_whitespace: false,
    word_wrap: false,
    auto_save_sessions: true,
  }
}

onMounted(() => {
  if (!store.loaded) store.load()
})
</script>

<template>
  <div class="settings-view">

    <!-- Header -->
    <div class="settings-header">
      <h2>⚙️ Settings</h2>
      <p class="desc">Configure OpenDiff appearance and behavior</p>
    </div>

    <div class="settings-body">

      <!-- ── Appearance ─────────────────────────────────────────── -->
      <section class="settings-section">
        <h3 class="section-title">Appearance</h3>

        <!-- Theme -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Theme</label>
            <span class="setting-desc">Choose light, dark, or follow system</span>
          </div>
          <div class="theme-group">
            <button
              v-for="opt in themeOptions"
              :key="opt.value"
              class="theme-btn"
              :class="{ active: store.settings.theme === opt.value }"
              @click="store.settings.theme = opt.value"
            >
              <component :is="opt.icon" size="16" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Font Family -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Font Family</label>
            <span class="setting-desc">Monospace font for code display</span>
          </div>
          <select v-model="store.settings.font_family" class="setting-select">
            <option v-for="f in fontOptions" :key="f" :value="f">{{ f }}</option>
          </select>
        </div>

        <!-- Font Size -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Font Size — {{ store.settings.font_size }}px</label>
            <span class="setting-desc">Base font size for editors and diff views</span>
          </div>
          <div class="range-row">
            <span class="range-label">10</span>
            <input
              :value="store.settings.font_size"
              @input="store.settings.font_size = Number(($event.target as HTMLInputElement).value)"
              type="range" min="10" max="24" step="1"
              class="range-input"
            />
            <span class="range-label">24</span>
            <span class="font-preview" :style="{ fontSize: store.settings.font_size + 'px' }">Aa</span>
          </div>
        </div>
      </section>

      <!-- ── Diff Engine ────────────────────────────────────────── -->
      <section class="settings-section">
        <h3 class="section-title">Diff Engine</h3>

        <!-- Algorithm -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Diff Algorithm</label>
            <span class="setting-desc">How diffs are computed (affects speed & quality)</span>
          </div>
          <select v-model="store.settings.diff_algorithm" class="setting-select">
            <option v-for="o in algoOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>

        <!-- Show Line Numbers -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Show Line Numbers</label>
            <span class="setting-desc">Display line numbers in diff views</span>
          </div>
          <label class="toggle">
            <input v-model="store.settings.show_line_numbers" type="checkbox" />
            <span class="toggle-slider" />
          </label>
        </div>

        <!-- Show Whitespace -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Show Whitespace</label>
            <span class="setting-desc">Highlight trailing spaces and tabs</span>
          </div>
          <label class="toggle">
            <input v-model="store.settings.show_whitespace" type="checkbox" />
            <span class="toggle-slider" />
          </label>
        </div>

        <!-- Word Wrap -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Word Wrap</label>
            <span class="setting-desc">Wrap long lines instead of horizontal scroll</span>
          </div>
          <label class="toggle">
            <input v-model="store.settings.word_wrap" type="checkbox" />
            <span class="toggle-slider" />
          </label>
        </div>
      </section>

      <!-- ── Sessions ───────────────────────────────────────────── -->
      <section class="settings-section">
        <h3 class="section-title">Sessions & History</h3>

        <!-- Auto-save -->
        <div class="setting-row">
          <div class="setting-info">
            <label>Auto-save Sessions</label>
            <span class="setting-desc">Automatically save open tabs on exit</span>
          </div>
          <label class="toggle">
            <input v-model="store.settings.auto_save_sessions" type="checkbox" />
            <span class="toggle-slider" />
          </label>
        </div>
      </section>

      <!-- ── About ─────────────────────────────────────────────── -->
      <section class="settings-section">
        <h3 class="section-title">About</h3>
        <div class="about-box">
          <div class="about-name">OpenDiff</div>
          <div class="about-version">Version 0.1.0</div>
          <div class="about-desc">Beyond Compare · Open Source</div>
          <div class="about-links">
            <a href="https://github.com/baseGame/OpenDiff" target="_blank" rel="noopener">GitHub Repository</a>
            <span>·</span>
            <a href="https://github.com/baseGame/OpenDiff/releases" target="_blank" rel="noopener">Releases</a>
          </div>
        </div>
      </section>

    </div>

    <!-- ── Actions ────────────────────────────────────────────────── -->
    <div class="settings-footer">
      <button class="btn btn-ghost" @click="resetDefaults">
        <RotateCcw :size="14" /> Reset Defaults
      </button>
      <button class="btn btn-primary"  @click="saveSettings">
        <Save :size="14" />
        {{ saveMsg }}
      </button>
    </div>

  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.settings-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.settings-header h2 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.desc { color: var(--color-text-muted); font-size: 13px; margin: 0; }

.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 80px;
}

.settings-section {
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin: 0 0 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.setting-info { flex: 1; min-width: 0; }
.setting-info label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 2px;
}
.setting-desc { font-size: 12px; color: var(--color-text-muted); }

/* Theme buttons */
.theme-group { display: flex; gap: 6px; }
.theme-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 12px; cursor: pointer; transition: all 0.15s;
}
.theme-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
.theme-btn.active { border-color: var(--color-accent); background: var(--color-accent); color: #fff; }

/* Select */
.setting-select {
  padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text); font-size: 13px;
  min-width: 180px; max-width: 220px;
  cursor: pointer;
}

/* Range */
.range-row { display: flex; align-items: center; gap: 8px; }
.range-label { font-size: 11px; color: var(--color-text-muted); width: 20px; text-align: center; }
.range-input {
  width: 140px; accent-color: var(--color-accent); cursor: pointer;
}
.font-preview {
  font-family: var(--font-mono, monospace);
  color: var(--color-accent);
  width: 36px; text-align: center;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 2px 4px;
  background: var(--color-surface);
}

/* Toggle */
.toggle { position: relative; display: inline-block; width: 38px; height: 22px; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute; inset: 0;
  background: var(--color-border);
  border-radius: 11px;
  transition: 0.2s;
}
.toggle-slider::before {
  content: ''; position: absolute;
  width: 16px; height: 16px; left: 3px; bottom: 3px;
  background: white; border-radius: 50%;
  transition: 0.2s;
}
.toggle input:checked + .toggle-slider { background: var(--color-accent); }
.toggle input:checked + .toggle-slider::before { transform: translateX(16px); }

/* About */
.about-box { padding: 12px; background: var(--color-surface); border-radius: 8px; border: 1px solid var(--color-border); }
.about-name { font-size: 15px; font-weight: 600; }
.about-version { font-size: 12px; color: var(--color-text-muted); margin: 2px 0; }
.about-desc { font-size: 12px; color: var(--color-text-muted); margin-bottom: 8px; }
.about-links { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.about-links a { color: var(--color-accent); text-decoration: none; }
.about-links a:hover { text-decoration: underline; }

/* Footer */
.settings-footer {
  position: absolute; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 24px;
  background: var(--color-bg2);
  border-top: 1px solid var(--color-border);
}
.btn-ghost {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 6px;
  border: 1px solid var(--color-border);
  background: transparent; color: var(--color-text-secondary);
  font-size: 13px; cursor: pointer;
}
.btn-ghost:hover { border-color: var(--color-accent); color: var(--color-accent); }
.btn-primary {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 16px; border-radius: 6px;
  border: none;
  background: var(--color-accent); color: white;
  font-size: 13px; cursor: pointer; font-weight: 500;
}
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
