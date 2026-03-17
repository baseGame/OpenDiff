<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import MenuBar from '@/components/toolbar/MenuBar.vue'
import TabBar from '@/components/tabs/TabBar.vue'
import StatusBar from '@/components/StatusBar.vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()
onMounted(() => settingsStore.load())
</script>

<template>
  <div class="app-layout flex flex-col h-full overflow-hidden">
    <MenuBar />
    <TabBar />
    <main class="flex-1 overflow-hidden">
      <RouterView />
    </main>
    <StatusBar />
  </div>
</template>

<style scoped>
.app-layout {
  background: var(--color-bg);
}
</style>
