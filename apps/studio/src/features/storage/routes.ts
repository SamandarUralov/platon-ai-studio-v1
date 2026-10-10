import type { RouteRecordRaw } from 'vue-router'

export const storageRoutes: RouteRecordRaw[] = [
  {
    path: 'storage/:kind?/:itemId?',
    name: 'storage',
    component: () => import('./StoragePage.vue'),
    meta: { layer: 'storage', title: 'Storage' },
  },
]
