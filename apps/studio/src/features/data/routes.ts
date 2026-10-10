import type { RouteRecordRaw } from 'vue-router'

export const dataRoutes: RouteRecordRaw[] = [
  {
    path: 'data/:connId?/:tableId?',
    name: 'data',
    component: () => import('./DataPage.vue'),
    meta: { layer: 'data', title: 'Data' },
  },
]
