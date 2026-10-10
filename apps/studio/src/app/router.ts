import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { interfaceRoutes } from '@/features/interface/routes'
import { logicRoutes } from '@/features/logic/routes'
import { dataRoutes } from '@/features/data/routes'
import { storageRoutes } from '@/features/storage/routes'
import { previewRoutes } from '@/features/preview/routes'
import { releasesRoutes } from '@/features/releases/routes'
import { advancedRoutes } from '@/features/advanced/routes'
import { componentsRoutes } from '@/features/components/routes'
import { settingsRoutes } from '@/features/settings/routes'
import { adminRoutes } from '@/features/admin/routes'

declare module 'vue-router' {
  interface RouteMeta {
    /** Studio layer this route belongs to (drives the top-bar tab). */
    layer?: string
    title?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/HomeLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/features/home/HomePage.vue'),
        meta: { title: 'Apps' },
      },
    ],
  },
  {
    path: '/new',
    name: 'new-project',
    component: () => import('@/features/new-project/NewProjectPage.vue'),
    meta: { title: 'New app' },
  },
  {
    path: '/p/:projectId',
    component: () => import('@/layouts/StudioLayout.vue'),
    children: [
      {
        path: '',
        name: 'project',
        redirect: (to) => ({ name: 'interface', params: { projectId: to.params.projectId } }),
      },
      ...interfaceRoutes,
      ...logicRoutes,
      ...dataRoutes,
      ...storageRoutes,
      ...previewRoutes,
      ...releasesRoutes,
      ...advancedRoutes,
      ...componentsRoutes,
      ...settingsRoutes,
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/HomeLayout.vue'),
    children: adminRoutes.map((r) => ({ ...r, path: r.path.replace(/^\/admin\/?/, '') })),
  },
  {
    path: '/signed-out',
    name: 'signed-out',
    component: () => import('@/features/auth/SignedOutPage.vue'),
    meta: { title: 'Signed out' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/features/auth/NotFoundPage.vue'),
    meta: { title: 'Not found' },
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Platon AI Studio` : 'Platon AI Studio'
})
