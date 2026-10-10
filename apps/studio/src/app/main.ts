import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import './styles.css'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { auth } from '@/services/auth'

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('@platon/mocks/browser')
    await startMocks()
  }
  await auth.init()

  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  })

  createApp(App).use(createPinia()).use(router).use(i18n).use(VueQueryPlugin, { queryClient }).mount('#app')
}

void bootstrap()
