import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import type { SessionResponse } from '@platon/definition'
import { http } from '@/services/http'
import { auth } from '@/services/auth'

export type ThemePref = 'light' | 'dark' | 'system'

export const useSessionStore = defineStore('session', () => {
  const session = ref<SessionResponse | null>(null)
  const loading = ref(false)
  const theme = useLocalStorage<ThemePref>('platon.theme', 'light')
  const studioLanguage = useLocalStorage('platon.studioLanguage', 'en')
  const prefersDark = usePreferredDark()

  const resolvedTheme = computed(() =>
    theme.value === 'system' ? (prefersDark.value ? 'dark' : 'light') : theme.value,
  )
  watch(resolvedTheme, (t) => (document.documentElement.dataset.theme = t), { immediate: true })

  const user = computed(() => session.value?.user ?? null)
  const canDeployProduction = computed(() => user.value?.role === 'owner' || user.value?.role === 'admin')
  const canEdit = computed(() => user.value?.role !== 'viewer')

  async function load() {
    if (session.value || loading.value) return
    loading.value = true
    try {
      session.value = (await http.get<SessionResponse>('/session')).data
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    session.value = null
    await auth.logout()
  }

  return {
    session,
    user,
    loading,
    theme,
    resolvedTheme,
    studioLanguage,
    canDeployProduction,
    canEdit,
    load,
    logout,
  }
})
