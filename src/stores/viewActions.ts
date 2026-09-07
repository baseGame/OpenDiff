import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ViewActionName } from '@/app/commandSystem'

export const useViewActionsStore = defineStore('viewActions', () => {
  const name = ref<ViewActionName | null>(null)
  const sequence = ref(0)

  function dispatch(action: ViewActionName): void {
    name.value = action
    sequence.value += 1
  }

  return {
    name,
    sequence,
    dispatch,
  }
})
