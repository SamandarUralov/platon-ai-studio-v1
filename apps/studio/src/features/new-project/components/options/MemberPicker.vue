<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import { onClickOutside, refDebounced } from '@vueuse/core'
import { ChevronsUpDown, Plus, Search, X } from 'lucide-vue-next'
import type { StudioUser } from '@platon/definition'
import { PAvatar, PButton, PSelect, PSpinner, cn, type SelectOption } from '@platon/ui'
import { http } from '@/services/http'
import { useSessionStore } from '@/stores/session'
import { PROJECT_ROLES, type ProjectRole } from '../../catalog'
import { useFlow, type Person } from '../../flow'

const MAX_SHOWN = 40

const flow = useFlow()
const session = useSessionStore()
const { t } = useI18n()
const id = useId()

const query = ref('')
const open = ref(false)
const hi = ref(0)
const root = ref<HTMLElement | null>(null)
const debounced = refDebounced(query, 150)
onClickOutside(root, () => (open.value = false))

const { data, isFetching } = useQuery({
  queryKey: computed(() => ['directory', debounced.value.trim()]),
  queryFn: async () =>
    (
      await http.get<{ items: StudioUser[]; total: number }>('/directory', {
        params: { q: debounced.value.trim() || undefined },
      })
    ).data,
  placeholderData: keepPreviousData,
  staleTime: 60_000,
})
// Unfiltered size of the directory, for the placeholder ("Search 120 people…").
const { data: all } = useQuery({
  queryKey: ['directory', ''],
  queryFn: async () => (await http.get<{ items: StudioUser[]; total: number }>('/directory')).data,
  staleTime: 60_000,
})

const added = computed(() => flow.teamIds.value)
const pool = computed(() => (data.value?.items ?? []).filter((u) => !added.value.includes(u.id)))
const shown = computed(() => pool.value.slice(0, MAX_SHOWN))

const roleOptions = computed<SelectOption<ProjectRole>[]>(() =>
  PROJECT_ROLES.map((r) => ({
    value: r,
    label: t(`newProject.roles.${r}`),
    description: t(`newProject.roleDesc.${r}`),
  })),
)
const members = computed(() =>
  added.value.map((uid) => {
    const p = flow.person(uid)
    const you = uid === session.user?.id
    const role = flow.state.roles[uid] ?? 'developer'
    return {
      id: uid,
      name: p?.name ?? uid,
      email: p?.email ?? '',
      you,
      role,
      roleDesc: t(`newProject.roleDesc.${you ? 'owner' : role}`),
    }
  }),
)

function add(u: StudioUser) {
  const p: Person = { id: u.id, name: u.name, email: u.email }
  flow.addMember(p)
  query.value = ''
  hi.value = 0
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    open.value = true
    hi.value = Math.min(shown.value.length - 1, hi.value + 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    hi.value = Math.max(0, hi.value - 1)
  } else if (e.key === 'Enter') {
    const u = shown.value[hi.value] ?? shown.value[0]
    // Let an empty, closed search fall through to the dock's "Enter = Next".
    if (!open.value || !u) return
    e.preventDefault()
    add(u)
  } else if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    open.value = false
  }
}
function onInput() {
  open.value = true
  hi.value = 0
}

const foot = computed(() =>
  pool.value.length > MAX_SHOWN
    ? t('newProject.team.showing', { shown: MAX_SHOWN, total: pool.value.length })
    : t('newProject.team.count', { n: pool.value.length }, pool.value.length),
)
const optionId = (i: number) => `${id}-opt-${i}`
</script>

<template>
  <div class="flex flex-col gap-3">
    <div ref="root" class="relative">
      <Search
        :size="15"
        class="pointer-events-none absolute left-3.5 top-3.5 text-faint-2"
        aria-hidden="true"
      />
      <input
        v-model="query"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="open && shown.length ? optionId(hi) : undefined"
        :aria-label="t('newProject.team.searchLabel')"
        :placeholder="t('newProject.team.search', { n: all?.total ?? 0 })"
        :class="
          cn(
            'h-11 w-full rounded-xl border-[1.5px] bg-surface px-10 text-lg outline-none placeholder:text-faint-2',
            open ? 'border-primary' : 'border-line',
          )
        "
        @focus="open = true"
        @input="onInput"
        @keydown="onKey"
      />
      <button
        type="button"
        tabindex="-1"
        :aria-label="t('newProject.team.toggle')"
        class="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-lg text-muted hover:bg-hover"
        @click="open = !open"
      >
        <ChevronsUpDown :size="15" aria-hidden="true" />
      </button>
      <div v-if="open" class="mt-1.5 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        <ul :id="`${id}-list`" role="listbox" class="scroll-thin max-h-[220px] overflow-auto p-1.5">
          <li
            v-for="(u, i) in shown"
            :id="optionId(i)"
            :key="u.id"
            role="option"
            :aria-selected="i === hi"
            :class="
              cn(
                'flex cursor-pointer items-center gap-[11px] rounded-[10px] px-2.5 py-2',
                i === hi ? 'bg-primary-tint/70' : 'hover:bg-subtle-2',
              )
            "
            @mousedown.prevent
            @mousemove="hi = i"
            @click="add(u)"
          >
            <PAvatar :name="u.name" :size="30" />
            <span class="min-w-0 flex-1">
              <span class="block text-md font-semibold">{{ u.name }}</span>
              <span class="block truncate text-sm text-faint">{{ u.email }}</span>
            </span>
            <span class="flex items-center gap-1 text-sm font-semibold text-primary"
              ><Plus :size="13" aria-hidden="true" />{{ t('newProject.team.add') }}</span
            >
          </li>
          <li v-if="!shown.length && isFetching" class="flex justify-center p-4 text-faint">
            <PSpinner :size="16" />
          </li>
          <li v-else-if="!shown.length" class="p-[18px] text-center text-base text-faint">
            {{ t('newProject.team.none', { q: query }) }}
          </li>
        </ul>
        <div class="flex gap-1.5 border-t border-line-faint px-3.5 py-2 text-sm text-faint">{{ foot }}</div>
      </div>
    </div>

    <div class="overflow-hidden rounded-[13px] border border-line-2 bg-surface">
      <div class="border-b border-line-faint bg-subtle-2 px-3.5 py-[9px] text-sm font-bold text-muted">
        {{ t('newProject.team.added', { n: members.length }) }}
      </div>
      <ul>
        <li
          v-for="m in members"
          :key="m.id"
          class="flex items-center gap-[11px] border-b border-line-faint py-[9px] pl-3.5 pr-2.5 last:border-b-0"
        >
          <PAvatar :name="m.name" :size="30" />
          <div class="min-w-0 flex-1">
            <div class="text-md font-semibold">{{ m.name }}</div>
            <div class="truncate text-sm text-faint">{{ m.email }} · {{ m.roleDesc }}</div>
          </div>
          <span v-if="m.you" class="px-2.5 text-sm font-semibold text-muted">{{
            t('newProject.team.ownerYou')
          }}</span>
          <template v-else>
            <PSelect
              :model-value="m.role"
              :options="roleOptions"
              size="sm"
              class="w-[130px]"
              :aria-label="t('newProject.team.role', { name: m.name })"
              @update:model-value="(r) => r && flow.setRole(m.id, r)"
            />
            <PButton
              variant="ghost"
              square
              size="sm"
              :icon="X"
              :label="t('newProject.team.remove', { name: m.name })"
              @click="flow.removeMember(m.id)"
            />
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>
