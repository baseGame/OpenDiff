<script setup lang="ts">
/**
 * ImportanceRules — 编辑重要性规则（忽略特定行/字符）
 * 每个规则: { id, enabled, name, pattern, isRegex, scope }
 */
import { ref, computed } from 'vue'

export interface ImportanceRule {
  id: string
  enabled: boolean
  name: string
  pattern: string
  isRegex: boolean
  scope: 'ignore'   // ignore matching lines in diff
}

const props = defineProps<{ visible: boolean; rules: ImportanceRule[] }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update', rules: ImportanceRule[]): void
}>()

const localRules = ref<ImportanceRule[]>([...props.rules])

function addRule() {
  localRules.value.push({ id: `r_${Date.now()}`, enabled: true, name: '', pattern: '', isRegex: false, scope: 'ignore' })
}

function removeRule(id: string) {
  localRules.value = localRules.value.filter(r => r.id !== id)
}

function save() {
  emit('update', [...localRules.value])
  emit('close')
}

// Test a pattern against sample text
const testInput = ref('')
const testOutput = ref('')
function testPattern(rule: ImportanceRule) {
  if (!rule.pattern) { testOutput.value = ''; return }
  try {
    if (rule.isRegex) {
      const re = new RegExp(rule.pattern, 'g')
      testOutput.value = testInput.value.replace(re, '~~MATCH~~')
    } else {
      testOutput.value = testInput.value.split(rule.pattern).join('~~MATCH~~')
    }
  } catch { testOutput.value = '❌ Invalid regex' }
}

// Built-in presets
const presets = [
  { name: '空白行', pattern: '^\\s*$', isRegex: true, desc: '忽略空白行' },
  { name: '行号', pattern: '^\\s*\\d+\\s+', isRegex: true, desc: '忽略行首行号' },
  { name: 'TODO/FIXME', pattern: '(TODO|FIXME|XXX)', isRegex: false, desc: '忽略 TODO 注释' },
  { name: '时间戳', pattern: '\\d{4}-\\d{2}-\\d{2}', isRegex: true, desc: '忽略日期' },
  { name: 'UUID', pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', isRegex: true, desc: '忽略 UUID' },
]

function applyPreset(p: typeof presets[0]) {
  localRules.value.push({ id: `r_${Date.now()}`, enabled: true, name: p.name, pattern: p.pattern, isRegex: p.isRegex, scope: 'ignore' })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="ir-overlay" @click.self="emit('close')">
      <div class="ir-modal">

        <!-- Header -->
        <div class="ir-hdr">
          <div class="ir-title">⚙️ {{ $t('importance.title') || 'Importance Rules' }}</div>
          <button class="ir-close" @click="emit('close')">✕</button>
        </div>

        <!-- Presets -->
        <div class="ir-presets">
          <span class="ir-preset-lbl">{{ $t('importance.presets') || 'Presets:' }}</span>
          <button v-for="p in presets" :key="p.name" class="ir-preset-btn" @click="applyPreset(p)"
            :title="p.desc">+ {{ p.name }}</button>
        </div>

        <!-- Rule list -->
        <div class="ir-body">
          <div v-if="!localRules.length" class="ir-empty">
            <div>{{ $t('importance.no_rules') || 'No rules yet. Add one or choose a preset.' }}</div>
          </div>

          <div v-for="(rule, i) in localRules" :key="rule.id" class="ir-rule">
            <div class="ir-rule-top">
              <input type="checkbox" v-model="rule.enabled" class="ir-check" />
              <input v-model="rule.name" class="ir-name-input" placeholder="Rule name" />
              <button class="ir-del" @click="removeRule(rule.id)">✕</button>
            </div>
            <div class="ir-rule-bot">
              <label class="ir-regex-label">
                <input type="checkbox" v-model="rule.isRegex" class="ir-check" />
                <span>Regex</span>
              </label>
              <input v-model="rule.pattern" class="ir-pattern" placeholder="Pattern to match..."
                @input="testPattern(rule)" />
            </div>
            <!-- Test area -->
            <div class="ir-test">
              <input v-model="testInput" class="ir-test-input" placeholder="Test input..." />
              <div class="ir-test-out" :class="{ 'ir-test-match': testOutput.includes('~~MATCH~~') }">
                {{ testOutput || '...' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Add rule -->
        <div class="ir-add">
          <button class="ir-add-btn" @click="addRule">+ {{ $t('importance.add_rule') || 'Add Rule' }}</button>
        </div>

        <!-- Footer -->
        <div class="ir-footer">
          <span class="ir-hint">{{ $t('importance.hint') || 'Matched lines will be hidden from the diff view' }}</span>
          <button class="ir-btn-cancel" @click="emit('close')">{{ $t('common.cancel') }}</button>
          <button class="ir-btn-save" @click="save">{{ $t('common.save') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ir-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px) }
.ir-modal { background:var(--color-bg2,#1e1e2e); border:1px solid var(--color-border,#3f3f46); border-radius:12px; width:560px; max-height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,.5) }
.ir-hdr { display:flex; align-items:center; justify-content:space-between; padding:14px 20px 10px; border-bottom:1px solid var(--color-border,#3f3f46); flex-shrink:0 }
.ir-title { font-size:14px; font-weight:700; color:var(--color-text,#f4f4f5) }
.ir-close { background:transparent; border:none; color:var(--color-text-muted,#a1a1aa); cursor:pointer; font-size:14px; padding:4px }
.ir-close:hover { color:var(--color-text,#f4f4f5) }
.ir-presets { display:flex; align-items:center; gap:6px; padding:8px 20px; border-bottom:1px solid var(--color-border,#3f3f46); flex-shrink:0; flex-wrap:wrap }
.ir-preset-lbl { font-size:11px; color:var(--color-text-muted,#71717a); flex-shrink:0 }
.ir-preset-btn { padding:2px 8px; border-radius:4px; border:1px solid var(--color-border,#3f3f46); background:transparent; color:var(--color-text-muted,#a1a1aa); font-size:11px; cursor:pointer }
.ir-preset-btn:hover { border-color:var(--color-accent,#3b82f6); color:var(--color-accent,#3b82f6) }
.ir-body { flex:1; overflow-y:auto; padding:12px 20px; display:flex; flex-direction:column; gap:10px }
.ir-empty { text-align:center; padding:24px; color:var(--color-text-muted,#71717a); font-size:13px }
.ir-rule { background:var(--color-surface,#27272a); border:1px solid var(--color-border,#3f3f46); border-radius:8px; padding:10px 12px; display:flex; flex-direction:column; gap:6px }
.ir-rule-top { display:flex; align-items:center; gap:8px }
.ir-check { width:14px; height:14px; accent-color:var(--color-accent,#3b82f6) }
.ir-name-input { flex:1; background:transparent; border:none; outline:none; color:var(--color-text,#f4f4f5); font-size:12px }
.ir-name-input::placeholder { color:var(--color-text-muted,#71717a) }
.ir-del { background:transparent; border:none; color:var(--color-text-muted,#71717a); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:4px }
.ir-del:hover { background:rgba(239,68,68,.15); color:#ef4444 }
.ir-rule-bot { display:flex; align-items:center; gap:8px }
.ir-regex-label { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--color-text-muted,#a1a1aa); flex-shrink:0; cursor:pointer }
.ir-pattern { flex:1; padding:4px 8px; border-radius:6px; border:1px solid var(--color-border,#3f3f46); background:var(--color-bg3,#3f3f46); color:var(--color-text,#f4f4f5); font-size:12px; outline:none; font-family:monospace }
.ir-pattern:focus { border-color:var(--color-accent,#3b82f6) }
.ir-test { display:flex; flex-direction:column; gap:3px }
.ir-test-input { padding:3px 6px; border-radius:4px; border:1px solid var(--color-border,#3f3f46); background:var(--color-bg3,#3f3f46); color:var(--color-text,#f4f4f5); font-size:11px; outline:none; font-family:monospace }
.ir-test-out { padding:2px 6px; border-radius:4px; background:var(--color-bg,#18181b); font-size:11px; font-family:monospace; color:var(--color-text-muted,#71717a); min-height:18px; word-break:break-all }
.ir-test-out.ir-test-match { color:#22c55e; background:rgba(34,197,94,.08) }
.ir-add { padding:8px 20px; border-top:1px solid var(--color-border,#3f3f46); flex-shrink:0 }
.ir-add-btn { padding:5px 12px; border-radius:6px; border:1px dashed var(--color-border,#3f3f46); background:transparent; color:var(--color-text-muted,#a1a1aa); font-size:12px; cursor:pointer; width:100% }
.ir-add-btn:hover { border-color:var(--color-accent,#3b82f6); color:var(--color-accent,#3b82f6) }
.ir-footer { padding:10px 20px; border-top:1px solid var(--color-border,#3f3f46); display:flex; align-items:center; gap:8px; flex-shrink:0 }
.ir-hint { flex:1; font-size:11px; color:var(--color-text-muted,#71717a) }
.ir-btn-cancel { padding:5px 14px; border-radius:8px; border:1px solid var(--color-border,#3f3f46); background:transparent; color:var(--color-text-muted,#a1a1aa); font-size:12px; cursor:pointer }
.ir-btn-save { padding:5px 14px; border-radius:8px; border:none; background:var(--color-accent,#3b82f6); color:white; font-size:12px; cursor:pointer; font-weight:600 }
.ir-btn-save:hover { background:#2563eb }
</style>
