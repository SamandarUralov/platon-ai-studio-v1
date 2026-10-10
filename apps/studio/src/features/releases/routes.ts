import type { RouteRecordRaw } from 'vue-router'

export const releasesRoutes: RouteRecordRaw[] = [
  {
    path: 'releases',
    name: 'releases',
    component: () => import('./ReleasesPage.vue'),
    meta: { layer: 'releases', title: 'Releases' },
  },
]
