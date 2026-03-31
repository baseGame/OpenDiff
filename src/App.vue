<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const router = useRouter()
const route = useRoute()

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.ctrlKey || e.metaKey) {
    if (e.key === ',') { e.preventDefault(); router.push('/settings') }
    if (e.key === 'o' && !e.shiftKey) {
      e.preventDefault()
      const leftEl = document.querySelector('.path-btn') as HTMLElement
      leftEl?.click()
    }
    if (e.key === 'O' || (e.shiftKey && e.key === 'o')) {
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

onMounted(() => { window.addEventListener('keydown', onKeydown) })
onUnmounted(() => { window.removeEventListener('keydown', onKeydown) })
</script>

<template>
  <AppLayout />
</template>
