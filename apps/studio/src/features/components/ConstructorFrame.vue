<script lang="ts">
/** Last probe result per origin, so reopening a component doesn't wait for the handshake again. */
const reachability = new Map<string, 'up' | 'down'>()

export function constructorOrigin(): string {
  try {
    return new URL(import.meta.env.VITE_CONSTRUCTOR_ORIGIN || 'http://localhost:5174').origin
  } catch {
    return ''
  }
}
export function constructorKnownDown(): boolean {
  return reachability.get(constructorOrigin()) === 'down'
}
export function forgetConstructorProbe() {
  reachability.delete(constructorOrigin())
}
</script>

<script setup lang="ts">
/**
 * Iframe host for the Constructor (docs/IMPLEMENTATION_PLAN.md F14). The Constructor runs on its own
 * origin; we talk to it only through the typed, origin-checked `@platon/bridge` channel:
 *   guest:ready → (token from the session endpoint) → host:init → theme / props / viewport updates.
 * No token in the URL, never '*' as targetOrigin. If the origin can't be reached or the handshake
 * times out, `unavailable` is emitted and the screen falls back to the built-in editor.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createHostChannel,
  type ComponentMeta,
  type ConstructorStatus,
  type HostMessages,
  type Theme,
} from '@platon/bridge'
import { PSpinner } from '@platon/ui'
import { errorMessage } from '@/services/http'
import { createComponentSession } from './api'

const props = withDefaults(
  defineProps<{
    projectId: string
    /** Short id (part after `component:`). */
    componentId: string
    componentName: string
    theme: Theme
    locale: string
    studioRole: string
    values: Record<string, unknown>
    viewportWidth?: number
    handshakeMs?: number
  }>(),
  { handshakeMs: 6000, viewportWidth: 0 },
)
const emit = defineEmits<{
  ready: []
  unavailable: [reason: 'unreachable' | 'timeout' | 'same-origin' | 'session']
  'version-mismatch': [got: number, want: number]
  status: [status: ConstructorStatus]
  dirty: [dirty: boolean]
  meta: [meta: ComponentMeta]
  resize: [height: number]
  error: [code: string, message: string]
  navigate: [to: string]
}>()
const { t } = useI18n()

const origin = constructorOrigin()
const frame = ref<HTMLIFrameElement>()
const phase = ref<'probing' | 'connecting' | 'ready'>('probing')
const src = ref<string | null>(null)
let channel: ReturnType<typeof createHostChannel> | null = null
let handshake: ReturnType<typeof setTimeout> | null = null
let disposed = false

function fail(reason: 'unreachable' | 'timeout' | 'same-origin' | 'session') {
  if (disposed) return
  if (reason === 'unreachable' || reason === 'timeout') reachability.set(origin, 'down')
  emit('unavailable', reason)
}

/** Cheap reachability check before mounting an iframe that would show a browser error page. */
async function probe(): Promise<boolean> {
  if (reachability.get(origin) === 'up') return true
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 1500)
  try {
    await fetch(`${origin}/embed`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function safeSend<K extends Exclude<keyof HostMessages, 'host:init'>>(type: K, payload: HostMessages[K]) {
  if (phase.value !== 'ready' || !channel) return
  try {
    channel.send(type, payload)
  } catch {
    // The frame went away (navigation/unmount); the next init will resync.
  }
}

async function onReady() {
  if (handshake) clearTimeout(handshake)
  handshake = null
  try {
    const session = await createComponentSession(props.projectId, props.componentId)
    if (disposed || !channel) return
    channel.send('host:init', {
      projectId: props.projectId,
      componentId: `component:${props.componentId}`,
      token: session.token,
      locale: props.locale,
      theme: props.theme,
      studioRole: props.studioRole,
    })
    phase.value = 'ready'
    reachability.set(origin, 'up')
    safeSend('host:props', { values: { ...props.values } })
    if (props.viewportWidth) safeSend('host:viewport', { width: props.viewportWidth })
    emit('ready')
  } catch (e) {
    emit('error', 'session', errorMessage(e))
    fail('session')
  }
}

onMounted(async () => {
  if (!origin || origin === window.location.origin) return fail('same-origin')
  if (!(await probe())) return fail('unreachable')
  if (disposed) return
  channel = createHostChannel({ target: () => frame.value?.contentWindow ?? null, origin, timeoutMs: 8000 })
  channel.on('guest:ready', () => void onReady())
  channel.on('$version-mismatch', (p) => emit('version-mismatch', p.got, p.want))
  channel.on('guest:status', (p) => emit('status', p.status))
  channel.on('guest:dirty', (p) => emit('dirty', !!p.dirty))
  channel.on('guest:meta', (p) => emit('meta', p.meta))
  channel.on('guest:resize', (p) => emit('resize', Number(p.height) || 0))
  channel.on('guest:error', (p) => emit('error', String(p.code), String(p.message)))
  channel.on('guest:navigate', (p) => emit('navigate', String(p.to)))
  const q = new URLSearchParams({ project: props.projectId, component: props.componentId })
  src.value = `${origin}/embed?${q.toString()}`
  phase.value = 'connecting'
  handshake = setTimeout(() => fail('timeout'), props.handshakeMs)
})

onBeforeUnmount(() => {
  disposed = true
  if (handshake) clearTimeout(handshake)
  channel?.close()
  channel = null
})

watch(
  () => props.theme,
  (theme) => safeSend('host:theme', { theme }),
)
watch(
  () => props.values,
  (values) => safeSend('host:props', { values: { ...values } }),
  { deep: true },
)
watch(
  () => props.viewportWidth,
  (width) => width && safeSend('host:viewport', { width }),
)

defineExpose({ command: (name: 'save' | 'discard' | 'format') => safeSend('host:command', { name }) })
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col bg-bg">
    <iframe
      v-if="src"
      ref="frame"
      :src="src"
      :title="t('components.frame.frameTitle', { name: componentName })"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      allow="clipboard-write"
      referrerpolicy="strict-origin"
      class="min-h-0 w-full flex-1 border-0"
      :class="phase !== 'ready' && 'invisible'"
    />
    <div v-if="phase !== 'ready'" class="absolute inset-0 grid place-items-center">
      <div class="flex items-center gap-2 text-base text-muted">
        <PSpinner :size="16" />{{ t('components.frame.connecting') }}
      </div>
    </div>
  </div>
</template>
