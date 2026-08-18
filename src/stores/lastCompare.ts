import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TextDiffRequest } from '@/types/diff'

export interface LastTextCompareSnapshot extends TextDiffRequest {
  leftSource?: string
  rightSource?: string
}

export interface LastFolderCompareSnapshot {
  leftRoot: string
  rightRoot: string
}

export const useLastCompareStore = defineStore('lastCompare', () => {
  const text = ref<LastTextCompareSnapshot | null>(null)
  const folder = ref<LastFolderCompareSnapshot | null>(null)

  function recordTextCompare(snapshot: LastTextCompareSnapshot): void {
    text.value = snapshot
  }

  function recordFolderCompare(snapshot: LastFolderCompareSnapshot): void {
    folder.value = snapshot
  }

  return {
    text,
    folder,
    recordTextCompare,
    recordFolderCompare,
  }
})
