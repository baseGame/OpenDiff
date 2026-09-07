<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FolderCompareCriteria } from '@/types/diff'
import type { TextCompareSessionOptions } from '@/app/textCompareSessionOptions'

const props = defineProps<{
  open: boolean
  kind: 'folder' | 'text'
  folderCriteria: FolderCompareCriteria
  textOptions: TextCompareSessionOptions
}>()

const emit = defineEmits<{
  close: []
  apply: [
    payload:
      | { kind: 'folder'; criteria: FolderCompareCriteria }
      | { kind: 'text'; options: TextCompareSessionOptions },
  ]
}>()

type FolderTab = 'comparison' | 'filters'
type TextTab = 'importance' | 'alignment'

const folderTab = ref<FolderTab>('comparison')
const textTab = ref<TextTab>('importance')
const draftFolder = ref<FolderCompareCriteria>({ ...props.folderCriteria })
const draftText = ref<TextCompareSessionOptions>({
  ...props.textOptions,
  ignoreRegexes: [...props.textOptions.ignoreRegexes],
})
const ignoreRegexDraft = ref(props.textOptions.ignoreRegexes.join(', '))

watch(
  () => [props.open, props.folderCriteria, props.textOptions] as const,
  ([open]) => {
    if (!open) {
      return
    }

    draftFolder.value = { ...props.folderCriteria }
    draftText.value = {
      ...props.textOptions,
      ignoreRegexes: [...props.textOptions.ignoreRegexes],
    }
    ignoreRegexDraft.value = props.textOptions.ignoreRegexes.join(', ')
    folderTab.value = 'comparison'
    textTab.value = 'importance'
  },
)

const titleKey = computed(() =>
  props.kind === 'folder' ? 'ui.folderSessionSettings' : 'ui.textSessionSettings',
)

function applySettings(): void {
  if (props.kind === 'folder') {
    emit('apply', { kind: 'folder', criteria: { ...draftFolder.value } })

    return
  }

  const ignoreRegexes = ignoreRegexDraft.value
    .split(/[,\n]/u)
    .map((item) => item.trim())
    .filter(Boolean)

  emit('apply', {
    kind: 'text',
    options: {
      ...draftText.value,
      ignoreRegexes,
    },
  })
}
</script>

<template>
  <div
    v-if="open"
    class="session-settings-backdrop"
    data-testid="session-settings-dialog"
  >
    <section
      class="session-settings-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="$t(titleKey)"
    >
      <header>
        <h2>{{ $t(titleKey) }}</h2>
        <button
          type="button"
          data-testid="session-settings-close"
          @click="emit('close')"
        >
          {{ $t('ui.close') }}
        </button>
      </header>

      <nav
        v-if="kind === 'folder'"
        class="settings-tabs"
      >
        <button
          type="button"
          :class="{ active: folderTab === 'comparison' }"
          data-testid="session-settings-tab-comparison"
          @click="folderTab = 'comparison'"
        >
          {{ $t('ui.comparison') }}
        </button>
        <button
          type="button"
          :class="{ active: folderTab === 'filters' }"
          data-testid="session-settings-tab-filters"
          @click="folderTab = 'filters'"
        >
          {{ $t('ui.filters') }}
        </button>
      </nav>

      <nav
        v-else
        class="settings-tabs"
      >
        <button
          type="button"
          :class="{ active: textTab === 'importance' }"
          data-testid="session-settings-tab-importance"
          @click="textTab = 'importance'"
        >
          {{ $t('ui.importance') }}
        </button>
        <button
          type="button"
          :class="{ active: textTab === 'alignment' }"
          data-testid="session-settings-tab-alignment"
          @click="textTab = 'alignment'"
        >
          {{ $t('ui.alignment') }}
        </button>
      </nav>

      <div
        v-if="kind === 'folder' && folderTab === 'comparison'"
        class="settings-body"
        data-testid="session-settings-folder-comparison"
      >
        <label>
          <input
            v-model="draftFolder.compareSize"
            type="checkbox"
            data-testid="session-settings-compare-size"
          />
          <span>{{ $t('ui.compareBySize') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareModifiedTime"
            type="checkbox"
            data-testid="session-settings-compare-timestamp"
          />
          <span>{{ $t('ui.compareByTimestamp') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareContents"
            type="checkbox"
            data-testid="session-settings-compare-contents"
          />
          <span>{{ $t('ui.compareBinaryContents') }}</span>
        </label>
        <label>
          <input
            v-model="draftFolder.compareCrc"
            type="checkbox"
            data-testid="session-settings-compare-crc"
          />
          <span>{{ $t('ui.compareCrc') }}</span>
        </label>
      </div>

      <div
        v-else-if="kind === 'folder'"
        class="settings-body"
        data-testid="session-settings-folder-filters"
      >
        <p>{{ $t('ui.sessionSettingsFiltersHint') }}</p>
      </div>

      <div
        v-else-if="textTab === 'importance'"
        class="settings-body"
        data-testid="session-settings-text-importance"
      >
        <label>
          <input
            v-model="draftText.ignoreWhitespace"
            type="checkbox"
            data-testid="session-settings-ignore-whitespace"
          />
          <span>{{ $t('ui.whitespace') }}</span>
        </label>
        <label>
          <input
            v-model="draftText.ignoreCase"
            type="checkbox"
            data-testid="session-settings-ignore-case"
          />
          <span>{{ $t('ui.case') }}</span>
        </label>
        <label>
          <input
            v-model="draftText.ignoreLineEndings"
            type="checkbox"
            data-testid="session-settings-ignore-line-endings"
          />
          <span>{{ $t('ui.lineEndings') }}</span>
        </label>
        <label class="stack">
          <span>{{ $t('ui.replacements') }}</span>
          <input
            v-model="ignoreRegexDraft"
            type="text"
            data-testid="session-settings-ignore-regexes"
            :placeholder="$t('ui.regex')"
          />
        </label>
      </div>

      <div
        v-else
        class="settings-body"
        data-testid="session-settings-text-alignment"
      >
        <label class="stack">
          <span>{{ $t('ui.alignment') }}</span>
          <select
            v-model="draftText.algorithm"
            data-testid="session-settings-algorithm"
          >
            <option value="myers">{{ $t('ui.myers') }}</option>
            <option value="patience">{{ $t('ui.patience') }}</option>
            <option value="histogram">{{ $t('ui.histogram') }}</option>
          </select>
        </label>
      </div>

      <footer>
        <button
          type="button"
          data-testid="session-settings-cancel"
          @click="emit('close')"
        >
          {{ $t('ui.cancel') }}
        </button>
        <button
          type="button"
          class="primary"
          data-testid="session-settings-apply"
          @click="applySettings"
        >
          {{ $t('ui.apply') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.session-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(15 23 42 / 0.45);
}

.session-settings-dialog {
  display: grid;
  gap: 12px;
  width: min(520px, 100%);
  padding: 16px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: var(--app-surface);
  box-shadow: 0 18px 44px rgb(15 23 42 / 0.18);
}

header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  margin: 0;
  font-size: 18px;
}

.settings-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settings-tabs button.active {
  border-color: var(--app-accent, #2563eb);
  color: var(--app-accent, #2563eb);
}

.settings-body {
  display: grid;
  gap: 10px;
}

.settings-body label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-body label.stack {
  display: grid;
  gap: 4px;
}

footer {
  justify-content: flex-end;
}

button.primary {
  background: var(--app-accent, #2563eb);
  color: #ffffff;
}
</style>
