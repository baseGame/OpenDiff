<script setup lang="ts">
import { ref, provide } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import GlobalToast from '@/components/GlobalToast.vue'
import KeyboardShortcuts from '@/components/KeyboardShortcuts.vue'

const toast = ref<InstanceType<typeof GlobalToast> | null>(null)
provide('toast', (msg: string, type?: 'success' | 'error' | 'info') => toast.value?.show(msg, type))

const router = useRouter()

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.ctrlKey || e.metaKey) {
    if (e.key === ',') { e.preventDefault(); router.push('/settings') }
    if (e.key === 'o' && !e.shiftKey) {
      e.preventDefault()
      const leftEl = document.querySelector<HTMLElement>('.path-btn')
      leftEl?.click()
    }
    if ((e.key === 'O') || (e.shiftKey && e.key === 'o')) {
      e.preventDefault()
      const btns = document.querySelectorAll<HTMLElement>('.path-btn')
      btns[btns.length - 1]?.click()
    }
  }
  if (e.key === 'Escape') {
    const panel = document.querySelector('.merge-panel') as HTMLElement
    if (panel) panel.remove()
  }
}

window.addEventListener('keydown', onKeydown)
</script>

<template>
  <AppLayout />
  <GlobalToast ref="toast" />
  <KeyboardShortcuts />
</template>
