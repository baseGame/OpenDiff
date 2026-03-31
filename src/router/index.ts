import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import SettingsView from '@/views/SettingsView.vue'
import HistoryView from '@/views/HistoryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/text-diff',
      name: 'text-diff',
      component: () => import('@/views/TextDiffView.vue'),
    },
    {
      path: '/folder-diff',
      name: 'folder-diff',
      component: () => import('@/views/FolderDiffView.vue'),
    },
    {
      path: '/table-diff',
      name: 'table-diff',
      component: () => import('@/views/TableDiffView.vue'),
    },
    {
      path: '/hex-diff',
      name: 'hex-diff',
      component: () => import('@/views/HexDiffView.vue'),
    },
    {
      path: '/image-diff',
      name: 'image-diff',
      component: () => import('@/views/ImageDiffView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/history',
      name: 'history',
      component: HistoryView,
    },
  ],
})

export default router
