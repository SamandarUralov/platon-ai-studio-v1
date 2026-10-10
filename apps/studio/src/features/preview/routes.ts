import type { RouteRecordRaw } from 'vue-router'

export const previewRoutes: RouteRecordRaw[] = [
  {
    path: 'preview/:pageId?',
    name: 'preview',
    component: () => import('./PreviewPage.vue'),
    meta: { layer: 'preview', title: 'Preview' },
  },
]
