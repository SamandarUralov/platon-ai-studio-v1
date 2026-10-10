<script setup lang="ts">
/** Properties form: the component's props as the single source for defineProps and page inputs. */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from 'lucide-vue-next'
import { toast } from '@platon/ui'
import type { ComponentProp, CustomComponent } from '@platon/definition'
import PropRow from './PropRow.vue'

const props = defineProps<{ component: CustomComponent; readonly?: boolean }>()
const emit = defineEmits<{ change: [props: ComponentProp[], text: string] }>()
const { t } = useI18n()

const openName = ref<string | null>(null)
const adding = ref<ComponentProp | null>(null)

const others = (name: string | null) => props.component.props.map((p) => p.name).filter((n) => n !== name)

function startAdd() {
  adding.value = { name: '', label: '', type: 'String', input: 'text', required: false }
  openName.value = null
}

function commit(i: number, next: ComponentProp, text: string) {
  const list = props.component.props.map((p, j) => (j === i ? next : p))
  if (openName.value === props.component.props[i]!.name) openName.value = next.name
  emit('change', list, `${text} in “${props.component.name}”`)
}

function remove(i: number) {
  const p = props.component.props[i]!
  emit(
    'change',
    props.component.props.filter((_, j) => j !== i),
    `Removed property ${p.name} from “${props.component.name}”`,
  )
  openName.value = null
  toast(t('components.prop.removed', { name: p.name }))
}

function add(p: ComponentProp) {
  emit(
    'change',
    [...props.component.props, p],
    `Added property ${p.name} (${p.type}) to “${props.component.name}”`,
  )
  adding.value = null
  toast(t('components.prop.addedToProps', { name: p.name }), { tone: 'ok' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3 scroll-thin">
    <div
      v-if="!component.props.length && !adding"
      class="rounded-[10px] border border-dashed border-line px-3 py-[18px] text-center text-sm leading-normal text-faint"
    >
      {{ t('components.prop.none') }}
    </div>
    <PropRow
      v-for="(p, i) in component.props"
      :key="`${i}:${p.name}`"
      :prop="p"
      :others="others(p.name)"
      :open="openName === p.name"
      :show-ai="component.status === 'needs_review'"
      :readonly="readonly"
      @toggle="openName = openName === p.name ? null : p.name"
      @commit="(next, text) => commit(i, next, text)"
      @remove="remove(i)"
    />
    <PropRow v-if="adding" :prop="adding" :others="others(null)" is-new @cancel="adding = null" @add="add" />
    <button
      v-if="!adding && !readonly"
      type="button"
      class="flex h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-primary-ring bg-primary-tint/40 text-md font-semibold text-primary-strong hover:bg-primary-tint"
      @click="startAdd"
    >
      <Plus :size="14" />{{ t('components.prop.add') }}
    </button>
  </div>
</template>
