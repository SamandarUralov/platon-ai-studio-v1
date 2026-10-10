<script setup lang="ts">
/** Page lifecycle (requirements §3.2.1): phases → hooks → ordered handlers. */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, FileCode, Plus } from 'lucide-vue-next'
import { LIFECYCLE_PHASES, type LifecycleHandler, type Page } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { useInterfaceEdits } from '../composables/useInterfaceEdits'
import { generatedJs, handlerCount, newHandler } from '../lib/lifecycle'
import { scriptFile } from '../lib/script'
import LifecycleHandlerCard from './LifecycleHandlerCard.vue'

const props = defineProps<{ page: Page }>()
const { t } = useI18n()
const def = useDefinitionStore()
const edits = useInterfaceEdits()
const open = ref<Set<string>>(new Set(Object.keys(props.page.lifecycle ?? {}).slice(0, 1)))
const showJs = ref<string | null>(null)
const total = computed(() => handlerCount(props.page.lifecycle))
const list = (hook: string) => props.page.lifecycle?.[hook] ?? []

function toggle(h: string) {
  const s = new Set(open.value)
  if (s.has(h)) s.delete(h)
  else s.add(h)
  open.value = s
}
function save(hook: string, next: LifecycleHandler[], text: string) {
  edits.setLifecycle(props.page, hook, next, text)
}
function add(hook: string, kind: LifecycleHandler['kind']) {
  const h = newHandler(kind, kind === 'function' ? def.definition?.logic.functions[0] : undefined)
  save(hook, [...list(hook), h], t('interface.change.lcAdd', { hook, page: props.page.name }))
}
function change(hook: string, i: number, h: LifecycleHandler) {
  const next = list(hook).slice()
  next[i] = h
  save(hook, next, t('interface.change.lcEdit', { hook, page: props.page.name }))
}
function remove(hook: string, i: number) {
  save(
    hook,
    list(hook).filter((_, j) => j !== i),
    t('interface.change.lcRemove', { hook, page: props.page.name }),
  )
}
function move(hook: string, i: number, dir: -1 | 1) {
  const next = list(hook).slice()
  const [h] = next.splice(i, 1)
  next.splice(i + dir, 0, h!)
  save(hook, next, t('interface.change.lcOrder', { hook, page: props.page.name }))
}
</script>

<template>
  <section>
    <div class="flex items-baseline">
      <span class="text-sm font-semibold text-fg-2">{{ t('interface.lc.title') }}</span>
      <span class="ml-auto text-xs text-faint">{{ t('interface.lc.count', { n: total }, total) }}</span>
    </div>
    <p class="mt-1 mb-3 text-xs text-muted">
      {{ t('interface.lc.intro') }} <code class="font-mono text-primary-strong">ctx.blocks</code>.
    </p>
    <div v-for="(phase, pi) in LIFECYCLE_PHASES" :key="phase.label" class="mb-2">
      <div class="mb-1 flex items-baseline gap-2 pl-0.5">
        <span class="eyebrow">{{ t(`interface.lc.phase.p${pi}`) }}</span>
        <span v-if="phase.sub" class="text-2xs text-faint">{{ t(`interface.lc.sub.p${pi}`) }}</span>
      </div>
      <div class="relative">
        <span class="absolute top-3 bottom-3 left-[5px] w-px bg-line" />
        <div v-for="h in phase.hooks" :key="h.name" class="relative pl-5">
          <span
            class="absolute top-[13px] left-0 size-[11px] rounded-full border-2"
            :class="list(h.name).length ? 'border-primary bg-primary' : 'border-line-2 bg-surface'"
          />
          <div class="mb-1 rounded-lg" :class="open.has(h.name) ? 'border border-line bg-subtle-2' : ''">
            <button
              type="button"
              class="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left hover:bg-hover"
              :aria-expanded="open.has(h.name)"
              @click="toggle(h.name)"
            >
              <ChevronRight
                :size="13"
                class="text-faint transition-transform"
                :class="open.has(h.name) ? 'rotate-90' : ''"
              />
              <span class="font-mono text-sm font-bold">{{ h.name }}</span>
              <span class="ml-auto font-mono text-2xs text-faint">{{ h.vue }}</span>
              <span
                v-if="list(h.name).length"
                class="grid size-[18px] place-items-center rounded-full bg-primary text-2xs font-bold text-on-accent"
                >{{ list(h.name).length }}</span
              >
            </button>
            <div v-if="open.has(h.name)" class="space-y-2 px-2 pb-2">
              <p class="text-xs text-muted">{{ h.hint }}</p>
              <p v-if="h.canCancel" class="rounded-md bg-warn-bg px-2 py-1 text-xs text-warn">
                {{ t('interface.lc.cancel') }}
              </p>
              <LifecycleHandlerCard
                v-for="(x, i) in list(h.name)"
                :key="x.id"
                :page="page"
                :hook="h.name"
                :handler="x"
                :index="i"
                :total="list(h.name).length"
                @change="change(h.name, i, $event)"
                @remove="remove(h.name, i)"
                @move="move(h.name, i, $event)"
              />
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-line text-sm text-fg-2 hover:bg-hover"
                  @click="add(h.name, 'function')"
                >
                  <Plus :size="13" />{{ t('interface.lc.fn') }}
                </button>
                <button
                  type="button"
                  class="flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-line text-sm text-fg-2 hover:bg-hover"
                  @click="add(h.name, 'code')"
                >
                  <Plus :size="13" />{{ t('interface.lc.code') }}
                </button>
              </div>
              <template v-if="list(h.name).length">
                <button
                  type="button"
                  class="flex w-full items-center gap-1.5 text-xs font-semibold text-primary-strong"
                  @click="showJs = showJs === h.name ? null : h.name"
                >
                  <FileCode :size="13" />{{
                    showJs === h.name ? t('interface.lc.hideJs') : t('interface.lc.showJs')
                  }}
                  <span class="ml-auto truncate font-mono font-normal text-faint">{{
                    scriptFile(page)
                  }}</span>
                </button>
                <div v-if="showJs === h.name">
                  <pre
                    class="m-0 max-h-48 overflow-auto rounded-lg bg-code-bg p-2.5 font-mono text-xs leading-5 text-code-fg scroll-thin"
                    >{{ generatedJs(h.name, list(h.name)) }}</pre>
                  <p class="mt-1 text-2xs text-faint">{{ t('interface.lc.readOnly') }}</p>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
