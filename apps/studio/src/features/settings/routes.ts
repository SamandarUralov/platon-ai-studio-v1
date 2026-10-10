import type { RouteRecordRaw } from 'vue-router'

export const settingsRoutes: RouteRecordRaw[] = [
  {
    path: 'settings/:section?',
    name: 'settings',
    component: () => import('./SettingsPage.vue'),
    meta: { layer: 'settings', title: 'Project settings' },
  },
]
