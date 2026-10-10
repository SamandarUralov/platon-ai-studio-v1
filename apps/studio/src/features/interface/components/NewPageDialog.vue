<script setup lang="ts">
/** "New page" modal: icon, name, route (follows the name until edited), menu placement and roles. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FilePlus2 } from 'lucide-vue-next'
import { PButton, PCheckbox, PDialog, PField, PInput, PSelect, PSwitch } from '@platon/ui'
import { newId, snake, uniqueName, type Page } from '@platon/definition'
import { useDefinitionStore } from '@/stores/definition'
import { routeError, routeFromName, TOP } from './routeRules'
import IconPicker from './IconPicker.vue'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ parent?: string }>()
const emit = defineEmits<{ create: [page: Page] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const pages = computed(() => def.definition?.interface.pages ?? [])
const roles = computed(() => def.definition?.roles ?? [])

const name = ref('')
const icon = ref('file-text')
const route = ref('/')
const routeTouched = ref(false)
const parentPick = ref(TOP)
const inMenu = ref(true)
const visible = ref<string[]>([])

const nameInput = ref<{ focus: () => void } | null>(null)
watch(open, (o) => {
  if (!o) return
  // The dialog focuses its first button; the name field is what people type into first.
  setTimeout(() => nameInput.value?.focus(), 60)
  name.value = ''
  icon.value = 'file-text'
  route.value = '/'
  routeTouched.value = false
  parentPick.value = props.parent ?? TOP
  inMenu.value = true
  visible.value = roles.value.map((r) => r.id)
})
const parentRoute = computed(() => pages.value.find((p) => p.id === parentPick.value)?.route)
watch([name, parentPick], () => {
  if (!routeTouched.value) route.value = routeFromName(name.value, parentRoute.value)
})
const err = computed(() => {
  const e = routeError(route.value, pages.value)
  return e.code ? t(`interface.route.${e.code}`, { page: e.other }) : null
})
const parentOptions = computed(() => [
  { value: TOP, label: t('interface.page.noParent') },
  ...pages.value.map((p) => ({ value: p.id, label: p.name })),
])
const valid = computed(() => !!name.value.trim() && !err.value && visible.value.length > 0)

function create() {
  if (!valid.value) return
  const id = uniqueName(
    snake(name.value) || 'page',
    pages.value.map((p) => p.id),
  )
  const page: Page = {
    id,
    name: name.value.trim(),
    icon: icon.value,
    route: route.value,
    ...(parentPick.value !== TOP ? { parent: parentPick.value } : {}),
    inMenu: inMenu.value,
    ...(visible.value.length < roles.value.length ? { visibleTo: visible.value } : {}),
    blocks: [
      {
        id: newId('blk'),
        type: 'header',
        ref: 'pageHeader',
        row: 0,
        title: name.value.trim(),
        props: { subtitle: '', buttonLabel: '', buttonWho: 'everyone' },
      },
    ],
  }
  emit('create', page)
  open.value = false
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :title="t('interface.newPage.title')"
    :description="t('interface.newPage.sub')"
    :icon="FilePlus2"
    :width="520"
  >
    <form class="space-y-4 pt-1" @submit.prevent="create">
      <PField :label="t('interface.page.icon')"><IconPicker v-model="icon" /></PField>
      <PField :label="t('interface.page.name')" required v-slot="{ id }">
        <PInput :id="id" ref="nameInput" v-model="name" :placeholder="t('interface.newPage.namePh')" />
      </PField>
      <PField :label="t('interface.page.route')" :error="name ? err : null" v-slot="{ id }">
        <PInput :id="id" v-model="route" mono :invalid="!!(name && err)" @input="routeTouched = true" />
      </PField>
      <PField :label="t('interface.page.parent')"
        ><PSelect v-model="parentPick" :options="parentOptions"
      /></PField>
      <label class="flex items-center gap-3">
        <PSwitch v-model="inMenu" />
        <span class="text-base font-semibold">{{ t('interface.page.inMenu') }}</span>
      </label>
      <PField
        :label="t('interface.newPage.roles')"
        :error="visible.length ? null : t('interface.newPage.rolesErr')"
      >
        <div class="grid grid-cols-2 gap-1.5">
          <PCheckbox
            v-for="r in roles"
            :key="r.id"
            :label="r.name"
            :model-value="visible.includes(r.id)"
            @update:model-value="
              (v) => (visible = v === true ? [...visible, r.id] : visible.filter((x) => x !== r.id))
            "
          />
        </div>
      </PField>
      <button type="submit" class="hidden" />
    </form>
    <template #footer>
      <PButton variant="ghost" @click="open = false">{{ t('interface.cancel') }}</PButton>
      <PButton variant="primary" :disabled="!valid" @click="create">{{
        t('interface.newPage.create')
      }}</PButton>
    </template>
  </PDialog>
</template>
