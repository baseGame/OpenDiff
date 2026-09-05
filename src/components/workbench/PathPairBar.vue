<script setup lang="ts">
import { ArrowLeftRight, FolderOpen, Play } from '@lucide/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from '@/i18n'

withDefaults(
  defineProps<{
    leftLabel?: string
    rightLabel?: string
    left: string
    right: string
    actionLabel?: string
    loading?: boolean
    showBrowse?: boolean
  }>(),
  {
    actionLabel: undefined,
    leftLabel: undefined,
    loading: false,
    rightLabel: undefined,
    showBrowse: true,
  },
)
const { t } = useI18n()

const emit = defineEmits<{
  'update:left': [value: string]
  'update:right': [value: string]
  swap: []
  run: []
  'browse-left': []
  'browse-right': []
}>()

const menu = ref<{ side: 'left' | 'right'; x: number; y: number }>()

function closeMenu(): void {
  menu.value = undefined
}

function onPathContextMenu(event: MouseEvent, side: 'left' | 'right'): void {
  event.preventDefault()
  menu.value = { side, x: event.clientX, y: event.clientY }
}

async function runMenuAction(action: 'clear' | 'paste'): Promise<void> {
  const side = menu.value?.side

  closeMenu()

  if (!side) {
    return
  }

  if (action === 'clear') {
    if (side === 'left') {
      emit('update:left', '')
    } else {
      emit('update:right', '')
    }

    return
  }

  try {
    const text = await navigator.clipboard.readText()

    if (!text) {
      return
    }

    if (side === 'left') {
      emit('update:left', text.trim())
    } else {
      emit('update:right', text.trim())
    }
  } catch {
    // ponytail: ignore clipboard denial
  }
}

function onDocumentClick(): void {
  closeMenu()
}

onMounted(() => window.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => window.removeEventListener('click', onDocumentClick))
</script>

<template>
  <section class="path-pair-bar">
    <label class="path-pair-field">
      <span>{{ leftLabel ?? t('ui.left') }}</span>
      <FolderOpen :size="14" />
      <input
        :value="left"
        type="text"
        data-testid="path-pair-left"
        @input="emit('update:left', ($event.target as HTMLInputElement).value)"
        @contextmenu="onPathContextMenu($event, 'left')"
      />
      <button
        v-if="showBrowse"
        type="button"
        data-testid="path-pair-browse-left"
        @click="emit('browse-left')"
      >
        {{ t('ui.browse') }}
      </button>
    </label>
    <button
      class="path-pair-swap"
      type="button"
      :aria-label="$t('ui.swapPaths')"
      @click="emit('swap')"
    >
      <ArrowLeftRight :size="14" />
    </button>
    <label class="path-pair-field">
      <span>{{ rightLabel ?? t('ui.right') }}</span>
      <FolderOpen :size="14" />
      <input
        :value="right"
        type="text"
        data-testid="path-pair-right"
        @input="emit('update:right', ($event.target as HTMLInputElement).value)"
        @contextmenu="onPathContextMenu($event, 'right')"
      />
      <button
        v-if="showBrowse"
        type="button"
        data-testid="path-pair-browse-right"
        @click="emit('browse-right')"
      >
        {{ t('ui.browse') }}
      </button>
    </label>
    <button
      class="path-pair-run"
      type="button"
      :disabled="loading"
      @click="emit('run')"
    >
      <Play :size="14" />
      <span>{{ actionLabel ?? t('ui.compare') }}</span>
    </button>
    <div
      v-if="menu"
      class="path-context-menu"
      data-testid="path-pair-context-menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @click.stop
    >
      <button
        type="button"
        @click="runMenuAction('clear')"
      >
        {{ t('ui.clear') }}
      </button>
      <button
        type="button"
        @click="runMenuAction('paste')"
      >
        {{ t('ui.paste') }}
      </button>
    </div>
  </section>
</template>
