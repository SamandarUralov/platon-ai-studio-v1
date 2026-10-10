<script setup lang="ts">
/** Block style: radius, colours, spacing, border, shadow, width, alignment and font size. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlignCenter, AlignLeft, AlignRight, RotateCcw } from 'lucide-vue-next'
import { PButton, PField, PSegmented, PSelect } from '@platon/ui'
import type { Block, BlockStyle, Page } from '@platon/definition'
import { DEFAULT_STYLE } from '@platon/renderer'
import { useInterfaceEdits } from '../../composables/useInterfaceEdits'

const props = defineProps<{ page: Page; block: Block }>()
const { t } = useI18n()
const edits = useInterfaceEdits()
const s = computed<Required<BlockStyle>>(() => ({ ...DEFAULT_STYLE, ...(props.block.style ?? {}) }))

/** Swatches are app colours (user data), shown as-is inside the swatch. */
const BG = ['transparent', '#ffffff', '#f6f7f9', '#e3f5ef', '#eef0ff', '#fff6e5', '#17182a']
const FG = ['', '#4a4c5e', '#0e7c66', '#3f4bd8', '#b42318', '#ffffff']

function set<K extends keyof BlockStyle>(k: K, v: BlockStyle[K], label: string) {
  edits.blockField(props.page, props.block, ['style', k], v === DEFAULT_STYLE[k] ? undefined : v, label)
}
const num = (e: Event, min: number, max: number) =>
  Math.max(min, Math.min(max, Number((e.target as HTMLInputElement).value) || 0))
const opts = (k: string, vals: string[]) =>
  vals.map((v) => ({ value: v, label: t(`interface.style.${k}.${v}`) }))
const aligns = computed(() => [
  { value: 'left' as const, icon: AlignLeft, title: t('interface.style.align.left') },
  { value: 'center' as const, icon: AlignCenter, title: t('interface.style.align.center') },
  { value: 'right' as const, icon: AlignRight, title: t('interface.style.align.right') },
])
function reset() {
  edits.blockField(props.page, props.block, ['style'], undefined, t('interface.style.resetDone'))
}
</script>

<template>
  <div class="space-y-3.5">
    <div class="grid grid-cols-3 gap-2">
      <PField
        v-for="[k, min, max] in [
          ['radius', 0, 48],
          ['pad', 0, 64],
          ['margin', 0, 96],
        ] as const"
        :key="k"
        :label="t(`interface.style.${k}`)"
        v-slot="{ id }"
      >
        <div
          class="flex h-[30px] items-center rounded-lg border border-line bg-surface pr-2 focus-within:border-primary"
        >
          <input
            :id="id"
            type="number"
            :min="min"
            :max="max"
            :value="s[k]"
            class="h-full w-full min-w-0 bg-transparent px-2 text-sm outline-none"
            @change="set(k, num($event, min, max), t(`interface.style.${k}Changed`))"
          />
          <span class="text-xs text-faint">px</span>
        </div>
      </PField>
    </div>
    <PField :label="t('interface.style.bg')">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in BG"
          :key="c"
          type="button"
          class="size-7 rounded-lg border"
          :class="[
            s.bg === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface' : '',
            c === 'transparent'
              ? 'bg-[repeating-conic-gradient(var(--p-line)_0_25%,transparent_0_50%)] bg-[length:8px_8px]'
              : '',
            'border-line',
          ]"
          :style="c !== 'transparent' ? { background: c } : undefined"
          :aria-label="c"
          @click="set('bg', c, t('interface.style.bgChanged'))"
        />
        <input
          type="color"
          class="size-7 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
          :value="s.bg.startsWith('#') ? s.bg : '#ffffff'"
          :aria-label="t('interface.style.custom')"
          @change="set('bg', ($event.target as HTMLInputElement).value, t('interface.style.bgChanged'))"
        />
      </div>
    </PField>
    <PField :label="t('interface.style.color')">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in FG"
          :key="c || 'auto'"
          type="button"
          class="grid size-7 place-items-center rounded-lg border border-line text-xs font-bold"
          :class="s.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface' : ''"
          :style="c ? { background: c } : undefined"
          :aria-label="c || t('interface.style.auto')"
          @click="set('color', c, t('interface.style.colorChanged'))"
        >
          <span v-if="!c" class="text-muted">A</span>
        </button>
        <input
          type="color"
          class="size-7 cursor-pointer rounded-lg border border-line bg-surface p-0.5"
          :value="s.color || '#17182a'"
          :aria-label="t('interface.style.custom')"
          @change="set('color', ($event.target as HTMLInputElement).value, t('interface.style.colorChanged'))"
        />
      </div>
    </PField>
    <div class="grid grid-cols-2 gap-2">
      <PField :label="t('interface.style.border.label')">
        <PSelect
          size="sm"
          :model-value="s.border"
          :options="opts('border', ['none', 'light', 'strong', 'accent'])"
          @update:model-value="
            (v) => v && set('border', v as BlockStyle['border'], t('interface.style.borderChanged'))
          "
        />
      </PField>
      <PField :label="t('interface.style.shadow.label')">
        <PSelect
          size="sm"
          :model-value="s.shadow"
          :options="opts('shadow', ['none', 'soft', 'raised'])"
          @update:model-value="
            (v) => v && set('shadow', v as BlockStyle['shadow'], t('interface.style.shadowChanged'))
          "
        />
      </PField>
      <PField :label="t('interface.style.width.label')">
        <PSelect
          size="sm"
          :model-value="s.width"
          :options="opts('width', ['full', 'wide', 'medium', 'narrow'])"
          @update:model-value="
            (v) => v && set('width', v as BlockStyle['width'], t('interface.style.widthChanged'))
          "
        />
      </PField>
      <PField :label="t('interface.style.font.label')">
        <PSelect
          size="sm"
          :model-value="String(s.font)"
          :options="opts('font', ['13', '15', '17', '19'])"
          @update:model-value="(v) => v && set('font', Number(v), t('interface.style.fontChanged'))"
        />
      </PField>
    </div>
    <PField :label="t('interface.style.align.label')">
      <PSegmented
        :model-value="s.align"
        :options="aligns"
        :aria-label="t('interface.style.align.label')"
        @update:model-value="set('align', $event, t('interface.style.alignChanged'))"
      />
    </PField>
    <PButton size="xs" variant="ghost" :icon="RotateCcw" :disabled="!block.style" @click="reset">{{
      t('interface.style.reset')
    }}</PButton>
  </div>
</template>
