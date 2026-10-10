<script setup lang="ts">
/** Width / device / zoom controls shared by the canvas and Preview. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Hand, Minus, Monitor, Plus, Smartphone, Tablet } from 'lucide-vue-next'
import { PKbd, PPopover, PSegmented } from '@platon/ui'
import { clampWidth, DEVICE_DEFAULT, deviceOf, stepZoom, WIDTHS, type Device } from '../lib/viewport'

const props = defineProps<{ effectiveZoom: number; showHand?: boolean }>()
const width = defineModel<number>('width', { required: true })
const zoom = defineModel<'fit' | number>('zoom', { required: true })
const hand = defineModel<boolean>('hand', { default: false })
const { t } = useI18n()

const device = computed<Device>({
  get: () => deviceOf(width.value),
  set: (d) => (width.value = DEVICE_DEFAULT[d]),
})
const ICON = { desktop: Monitor, tablet: Tablet, mobile: Smartphone }
const devices = computed(() =>
  (['desktop', 'tablet', 'mobile'] as const).map((d) => ({
    value: d,
    label: t(`interface.vp.${d}`),
    icon: ICON[d],
  })),
)
const widths = computed(() => WIDTHS.filter((w) => w.device === device.value))
const custom = ref(String(width.value))
watch(width, (w) => (custom.value = String(w)))
const pct = (z: number) => `${Math.round(z * 100)}%`
const zoomLabel = computed(() => pct(props.effectiveZoom))
function commitCustom() {
  width.value = clampWidth(Number(custom.value))
}
function step(dir: 1 | -1) {
  zoom.value = stepZoom(props.effectiveZoom, dir)
}
</script>

<template>
  <PPopover :width="296" align="center" class="p-2">
    <template #trigger>
      <button
        type="button"
        class="flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-2.5 text-base hover:bg-hover"
        :aria-label="t('interface.vp.label')"
      >
        <component :is="ICON[device]" :size="15" class="text-muted" />
        <span class="font-mono text-sm font-bold">{{ width }}px</span>
        <span class="text-faint">·</span>
        <span class="text-sm font-semibold text-muted">{{ zoomLabel }}</span>
        <ChevronDown :size="14" class="text-faint" />
      </button>
    </template>
    <PSegmented v-model="device" :options="devices" block size="md" :aria-label="t('interface.vp.device')" />
    <div class="mt-2">
      <button
        v-for="w in widths"
        :key="w.px"
        type="button"
        class="flex h-8 w-full items-center gap-3 rounded-lg px-2.5 text-base"
        :class="w.px === width ? 'bg-primary-tint' : 'hover:bg-hover'"
        @click="width = w.px"
      >
        <span class="w-14 font-mono text-sm font-bold">{{ w.px }}px</span>
        <span class="flex-1 text-left text-muted">{{ t(`interface.vp.w${w.px}`) }}</span>
        <Check v-if="w.px === width" :size="14" class="text-primary-strong" />
      </button>
      <label class="flex h-9 items-center gap-2 px-2.5 text-base text-muted">
        <span class="flex-1">{{ t('interface.vp.custom') }}</span>
        <input
          v-model="custom"
          inputmode="numeric"
          class="h-7 w-20 rounded-md border border-line bg-surface px-2 font-mono text-sm text-fg outline-none focus:border-primary"
          @keydown.enter="commitCustom"
          @blur="commitCustom"
        />
        <span class="text-xs text-faint">px</span>
      </label>
    </div>
    <div class="my-2 border-t border-line-faint" />
    <div class="flex h-9 items-center gap-2 px-2.5">
      <span class="flex-1 text-base font-semibold">{{ t('interface.vp.zoom') }}</span>
      <button
        type="button"
        class="grid size-7 place-items-center rounded-md border border-line hover:bg-hover"
        :aria-label="t('interface.vp.zoomOut')"
        @click="step(-1)"
      >
        <Minus :size="13" />
      </button>
      <span class="w-11 text-center text-sm font-bold">{{ zoomLabel }}</span>
      <button
        type="button"
        class="grid size-7 place-items-center rounded-md border border-line hover:bg-hover"
        :aria-label="t('interface.vp.zoomIn')"
        @click="step(1)"
      >
        <Plus :size="13" />
      </button>
    </div>
    <div class="grid grid-cols-3 gap-1.5 px-2.5 pb-1">
      <button
        v-for="z in ['fit', 0.5, 1] as const"
        :key="z"
        type="button"
        class="h-8 rounded-lg border text-sm font-semibold"
        :class="
          zoom === z
            ? 'border-primary-ring bg-primary-tint text-primary-strong'
            : 'border-line hover:bg-hover'
        "
        @click="zoom = z"
      >
        {{ z === 'fit' ? t('interface.vp.fit') : pct(z) }}
      </button>
    </div>
    <template v-if="showHand">
      <button
        type="button"
        class="mt-1 flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-base hover:bg-hover"
        :class="hand ? 'bg-primary-tint text-primary-strong' : ''"
        @click="hand = !hand"
      >
        <Hand :size="15" /><span class="flex-1 text-left font-semibold">{{ t('interface.vp.hand') }}</span
        ><PKbd>Space</PKbd>
      </button>
      <p class="px-2.5 pt-1 pb-1 text-xs text-faint">{{ t('interface.vp.hint') }}</p>
    </template>
  </PPopover>
</template>
