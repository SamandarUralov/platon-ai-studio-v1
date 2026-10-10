import type { RouteRecordRaw } from 'vue-router'

export const interfaceRoutes: RouteRecordRaw[] = [
  {
    path: 'interface/:pageId?',
    name: 'interface',
    component: () => import('./InterfacePage.vue'),
    meta: { layer: 'interface', title: 'Interface' },
  },
]
