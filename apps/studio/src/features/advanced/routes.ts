import type { RouteRecordRaw } from 'vue-router'

export const advancedRoutes: RouteRecordRaw[] = [
  {
    path: 'advanced',
    name: 'advanced',
    component: () => import('./AdvancedPage.vue'),
    meta: { layer: 'advanced', title: 'App definition' },
  },
]
