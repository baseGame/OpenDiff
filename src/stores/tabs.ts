import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tab, SessionKind } from '@/types'
import { useRouter } from 'vue-router'

const KIND_ROUTE: Record<SessionKind, string> = {
  text_diff: '/text-diff',
  folder_diff: '/folder-diff',
  table_diff: '/table-diff',
  hex_diff: '/hex-diff',
  image_diff: '/image-diff',
  folder_sync: '/folder-diff',
}

export const useTabStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeTabId = ref<string | null>(null)

  const activeTab = computed(() =>
    tabs.value.find(t => t.id === activeTabId.value) ?? null
  )

  function openTab(tab: Omit<Tab, 'id'>) {
    const id = crypto.randomUUID()
    tabs.value.push({ ...tab, id })
    activeTabId.value = id
    return id
  }

  function closeTab(id: string) {
    const idx = tabs.value.findIndex(t => t.id === id)
    if (idx === -1) return
    tabs.value.splice(idx, 1)
    if (activeTabId.value === id) {
      activeTabId.value = tabs.value[Math.max(0, idx - 1)]?.id ?? null
    }
  }

  function setActive(id: string) {
    activeTabId.value = id
  }

  function openNewDiff(kind: SessionKind, leftPath: string, rightPath: string) {
    const titles: Record<SessionKind, string> = {
      text_diff: 'Text Compare',
      folder_diff: 'Folder Compare',
      table_diff: 'Table Compare',
      hex_diff: 'Hex Compare',
      image_diff: 'Image Compare',
      folder_sync: 'Folder Sync',
    }
    return openTab({
      title: titles[kind],
      kind,
      leftPath,
      rightPath,
      isDirty: false,
    })
  }

  return { tabs, activeTabId, activeTab, openTab, closeTab, setActive, openNewDiff, KIND_ROUTE }
})
