<script setup lang="ts">
/** Block events. Binding lives only in page code: "Edit in code" opens (or creates) the handler. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Code, Zap } from 'lucide-vue-next'
import { BLOCKS, EVENT_ARG, type Block, type Page } from '@platon/definition'
import { useInterfaceStore } from '../../store'
import { usePageScript } from '../../code/usePageScript'

const props = defineProps<{ page: Page; block: Block }>()
const { t } = useI18n()
const ui = useInterfaceStore()
const script = usePageScript(() => props.page)
const events = computed(() =>
  BLOCKS[props.block.type].events.map((e) => {
    const key = `${props.block.ref}.${e}`
    return {
      e,
      key,
      arg: EVENT_ARG[e] ?? 'value',
      bound: script.source.value.includes(`'${key}'`) || script.source.value.includes(`"${key}"`),
    }
  }),
)
function open(e: string) {
  ui.jumpTo(script.handler(props.block.ref, e))
}
</script>

<template>
  <div>
    <p class="mb-2.5 text-xs text-muted">
      {{ t('interface.ev.intro') }}
      <code class="font-mono text-primary-strong">ctx.blocks.{{ block.ref }}</code
      >.
    </p>
    <p v-if="!events.length" class="text-sm text-faint">{{ t('interface.ev.none') }}</p>
    <div v-for="ev in events" :key="ev.e" class="mb-1.5 rounded-lg border border-line px-2.5 py-2">
      <div class="flex items-center gap-2">
        <Zap :size="13" class="shrink-0" :class="ev.bound ? 'text-primary' : 'text-faint-2'" />
        <span class="min-w-0 flex-1 truncate font-mono text-sm font-bold" :title="ev.key">{{ ev.key }}</span>
        <span class="shrink-0 font-mono text-2xs text-faint">(ctx, {{ ev.arg }})</span>
      </div>
      <div class="mt-1 flex items-center gap-2 pl-5">
        <span class="text-xs" :class="ev.bound ? 'text-ok' : 'text-faint'">{{
          ev.bound ? t('interface.ev.bound') : t('interface.ev.unbound')
        }}</span>
        <button
          type="button"
          class="ml-auto flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-primary-strong hover:bg-primary-tint"
          @click="open(ev.e)"
        >
          <Code :size="12" />{{ ev.bound ? t('interface.ev.open') : t('interface.ev.edit') }}
        </button>
      </div>
    </div>
  </div>
</template>
