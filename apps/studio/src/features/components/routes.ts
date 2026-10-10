import type { RouteRecordRaw } from 'vue-router'

export const componentsRoutes: RouteRecordRaw[] = [
  {
    path: 'components/:componentId?',
    name: 'components',
    component: () => import('./ComponentsPage.vue'),
    meta: { layer: 'components', title: 'Components' },
  },
]
