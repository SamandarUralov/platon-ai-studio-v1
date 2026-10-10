import type { RouteRecordRaw } from 'vue-router'

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/:section?',
    name: 'admin',
    component: () => import('./AdminPage.vue'),
    meta: { title: 'Admin' },
  },
]
