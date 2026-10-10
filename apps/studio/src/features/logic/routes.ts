import type { RouteRecordRaw } from 'vue-router'

export const logicRoutes: RouteRecordRaw[] = [
  {
    path: 'logic/:kind?/:itemId?',
    name: 'logic',
    component: () => import('./LogicPage.vue'),
    meta: { layer: 'logic', title: 'Logic' },
  },
]
