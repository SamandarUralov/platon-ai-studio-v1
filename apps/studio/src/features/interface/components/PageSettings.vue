<script setup lang="ts">
/** Inspector when nothing is selected: page icon, name, route, menu placement, lifecycle and permissions. */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Copy, Trash2 } from 'lucide-vue-next'
import { PButton, PCheckbox, PDialog, PField, PIcon, PInput, PSelect, PSwitch } from '@platon/ui'
import { pageTree, type Page, type PageNode, type PagePermission } from '@platon/definition'
import { pagePermission } from '@platon/renderer'
import { useDefinitionStore } from '@/stores/definition'
import { projectLinks, useProjectId } from '@/composables/useProject'
import { useInterfaceEdits } from '../composables/useInterfaceEdits'
import { routeError, TOP } from './routeRules'
import IconPicker from './IconPicker.vue'
import LifecycleSection from './LifecycleSection.vue'

const props = defineProps<{ page: Page }>()
const { t } = useI18n()
const def = useDefinitionStore()
const edits = useInterfaceEdits()
const router = useRouter()
const pid = useProjectId()
const pages = computed(() => def.definition?.interface.pages ?? [])
const roles = computed(() => def.definition?.roles ?? [])
const host = computed(() => `${def.definition?.settings.slug ?? 'app'}.platon.app`)

const name = ref(props.page.name)
const route = ref(props.page.route)
watch(
  () => props.page,
  (p) => {
    name.value = p.name
    route.value = p.route
  },
)
const routeErr = computed(() => {
  const e = routeError(route.value, pages.value, props.page.id)
  return e.code ? t(`interface.route.${e.code}`, { page: e.other }) : null
})

function saveName() {
  const v = name.value.trim()
  if (!v) return (name.value = props.page.name)
  if (v !== props.page.name)
    edits.pageField(props.page, ['name'], v, t('interface.change.pageName', { from: props.page.name, to: v }))
}
function saveRoute() {
  if (routeErr.value || route.value === props.page.route) return
  edits.pageField(
    props.page,
    ['route'],
    route.value,
    t('interface.change.pageRoute', { page: props.page.name, route: route.value }),
  )
}
function setIcon(icon: string) {
  edits.pageField(props.page, ['icon'], icon, t('interface.change.pageIcon', { page: props.page.name }))
}

/** Parents: any page except this one and its descendants. */
const parentOptions = computed(() => {
  const banned = new Set<string>([props.page.id])
  const walk = (ns: PageNode[], inside: boolean) =>
    ns.forEach((n) => {
      const ins = inside || n.id === props.page.id
      if (ins) banned.add(n.id)
      walk(n.children, ins)
    })
  walk(pageTree(pages.value), false)
  return [
    { value: TOP, label: t('interface.page.noParent') },
    ...pages.value.filter((p) => !banned.has(p.id)).map((p) => ({ value: p.id, label: p.name })),
  ]
})
function setParent(raw: string | undefined) {
  const v = raw === TOP ? undefined : raw
  const parent = pages.value.find((p) => p.id === v)
  edits.pageField(
    props.page,
    ['parent'],
    v || undefined,
    parent
      ? t('interface.change.pageParent', { page: props.page.name, parent: parent.name })
      : t('interface.change.pageTop', { page: props.page.name }),
  )
}
function setInMenu(v: boolean) {
  edits.pageField(
    props.page,
    ['inMenu'],
    v,
    t(v ? 'interface.change.inMenu' : 'interface.change.notInMenu', { page: props.page.name }),
  )
}

const ACTIONS: (keyof PagePermission)[] = ['view', 'create', 'edit', 'delete']
const permSummary = computed(() => {
  const n = roles.value.filter((r) => pagePermission(props.page, r.id, 'view')).length
  return n === roles.value.length
    ? t('interface.perm.everyone')
    : t('interface.perm.some', { n, total: roles.value.length })
})

const confirmDelete = ref(false)
function duplicate() {
  const copy = edits.duplicatePage(props.page)
  if (copy) void router.push(projectLinks(pid.value).interface(copy.id))
}
function remove() {
  confirmDelete.value = false
  const next = pages.value.find((p) => p.id !== props.page.id)
  if (edits.deletePage(props.page) && next) void router.push(projectLinks(pid.value).interface(next.id))
}
</script>

<template>
  <div class="flex items-center gap-3 border-b border-line-faint px-3.5 py-3">
    <span class="grid size-9 place-items-center rounded-[10px] bg-teal-bg text-teal"
      ><PIcon :name="page.icon" :size="17"
    /></span>
    <div class="min-w-0">
      <div class="text-md font-bold">{{ t('interface.page.settings') }}</div>
      <div class="truncate text-xs text-faint">{{ t('interface.page.settingsSub') }}</div>
    </div>
  </div>
  <div class="space-y-4 px-3.5 py-3.5">
    <PField :label="t('interface.page.icon')">
      <IconPicker :model-value="page.icon" @update:model-value="setIcon" />
    </PField>
    <PField :label="t('interface.page.name')" v-slot="{ id }">
      <PInput :id="id" v-model="name" @change="saveName" @keydown.enter="saveName" />
    </PField>
    <PField :label="t('interface.page.route')" :error="routeErr" v-slot="{ id }">
      <div
        class="flex h-[34px] items-center rounded-[9px] border bg-surface focus-within:shadow-focus"
        :class="routeErr ? 'border-danger-dot' : 'border-line focus-within:border-primary'"
      >
        <span class="pl-2.5 font-mono text-sm text-faint">{{ host }}</span>
        <input
          :id="id"
          v-model="route"
          class="h-full min-w-0 flex-1 bg-transparent pr-2.5 font-mono text-sm text-fg outline-none"
          :aria-invalid="!!routeErr"
          @change="saveRoute"
          @keydown.enter="saveRoute"
        />
      </div>
    </PField>
    <PField
      :label="t('interface.page.parent')"
      :hint="page.parent ? t('interface.page.parentHint') : t('interface.page.topHint')"
    >
      <PSelect :model-value="page.parent ?? TOP" :options="parentOptions" @update:model-value="setParent" />
    </PField>
    <label class="flex items-start gap-3">
      <PSwitch :model-value="page.inMenu" @update:model-value="setInMenu" />
      <span>
        <span class="block text-base font-semibold">{{ t('interface.page.inMenu') }}</span>
        <span class="block text-xs text-faint">{{ t('interface.page.inMenuHint') }}</span>
      </span>
    </label>

    <LifecycleSection :page="page" />

    <section>
      <div class="mb-2 flex items-baseline">
        <span class="text-sm font-semibold text-fg-2">{{ t('interface.perm.title') }}</span>
        <span class="ml-auto text-xs text-faint">{{ permSummary }}</span>
      </div>
      <table class="w-full overflow-hidden rounded-xl border border-line text-sm">
        <thead>
          <tr class="bg-subtle text-xs text-muted">
            <th class="px-2.5 py-2 text-left font-semibold">{{ t('interface.perm.role') }}</th>
            <th v-for="a in ACTIONS" :key="a" class="px-1 py-2 font-semibold">
              {{ t(`interface.perm.${a}`) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in roles" :key="r.id" class="border-t border-line-faint">
            <td class="px-2.5 py-2 font-semibold">{{ r.name }}</td>
            <td v-for="a in ACTIONS" :key="a" class="py-2 text-center">
              <span class="inline-flex">
                <PCheckbox
                  :model-value="pagePermission(page, r.id, a)"
                  :aria-label="`${r.name} · ${t(`interface.perm.${a}`)}`"
                  @update:model-value="(v) => edits.setPermission(page, r.id, a, v === true)"
                />
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="mt-2 text-xs text-faint">{{ t('interface.perm.note') }}</p>
    </section>

    <div class="flex gap-2 pt-1">
      <PButton :icon="Copy" @click="duplicate">{{ t('interface.page.duplicate') }}</PButton>
      <PButton
        variant="danger"
        :icon="Trash2"
        :disabled="pages.length < 2"
        class="ml-auto"
        @click="confirmDelete = true"
        >{{ t('interface.page.delete') }}</PButton
      >
    </div>
  </div>

  <PDialog
    v-model:open="confirmDelete"
    :title="t('interface.page.deleteTitle', { page: page.name })"
    :description="t('interface.page.deleteBody')"
    :icon="Trash2"
  >
    <template #footer>
      <PButton variant="ghost" @click="confirmDelete = false">{{ t('interface.cancel') }}</PButton>
      <PButton variant="danger-solid" @click="remove">{{ t('interface.page.delete') }}</PButton>
    </template>
  </PDialog>
</template>
