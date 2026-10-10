<script setup lang="ts">
/** One foldable Logic group with nested packages; items drag into packages, hover "+" creates. */
import { computed, ref, watch, type Directive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Folder, FolderOpen, FolderPlus, MoreHorizontal, Plus } from 'lucide-vue-next'
import { LOGIC_KINDS, type LogicKind, type LogicPackage } from '@platon/definition'
import { cn, PIcon, PMenu, PStatusDot, toneClasses, type MenuEntry, type Tone } from '@platon/ui'
import { useLogicEditor } from '../../store'
import { usePackages } from '../../composables/usePackages'
import { buildNavRows, resolvePackage, type NavEntry } from '../../lib/nav'

const props = defineProps<{
  kind: LogicKind
  entries: NavEntry[]
  packages: LogicPackage[]
  activeId: string | null
  statuses: Map<string, Tone>
  dirty: Set<string>
  badgeTone: (e: NavEntry) => Tone
}>()
const emit = defineEmits<{ open: [id: string]; create: [pkg?: string] }>()
const { t } = useI18n()
const ed = useLogicEditor()
const pk = usePackages()

const meta = computed(() => LOGIC_KINDS[props.kind])
const open = computed({
  get: () => ed.openGroups[props.kind] ?? true,
  set: (v: boolean) => (ed.openGroups = { ...ed.openGroups, [props.kind]: v }),
})
const openSet = computed(() => new Set(ed.openPkgs))
// Reveal the open item: expand its group and every package above it.
watch(
  () => props.activeId,
  (id) => {
    const e = id ? props.entries.find((x) => x.id === id) : undefined
    if (!e) return
    open.value = true
    for (
      let p = resolvePackage(e.package, props.packages);
      p;
      p = p.parent ? props.packages.find((x) => x.id === p!.parent) : undefined
    )
      ed.togglePkg(p.id, true)
  },
  { immediate: true },
)
const rows = computed(() => (open.value ? buildNavRows(props.entries, props.packages, openSet.value) : []))

// ── inline package name editing ──
const editing = ref<{ mode: 'new' | 'rename'; id?: string; parent?: string; name: string } | null>(null)
/** Inline name inputs take focus (and select their text) once, when they appear. */
const vFocus: Directive<HTMLInputElement> = {
  mounted: (el) => {
    el.focus()
    el.select()
  },
}
function startNew(parent?: string) {
  open.value = true
  if (parent) ed.togglePkg(parent, true)
  editing.value = { mode: 'new', parent, name: '' }
}
function startRename(p: LogicPackage) {
  editing.value = { mode: 'rename', id: p.id, name: p.name }
}
function commit() {
  const e = editing.value
  editing.value = null
  if (!e) return
  if (e.mode === 'new') {
    const p = pk.create(props.kind, e.name, e.parent)
    if (p) ed.togglePkg(p.id, true)
  } else if (e.id) pk.rename(e.id, e.name)
}

function pkgMenu(p: LogicPackage): MenuEntry[] {
  return [
    {
      label: t('logic.nav.newIn', { kind: t(`logic.noun.${props.kind}`) }),
      icon: Plus,
      onSelect: () => emit('create', p.id),
    },
    { label: t('logic.nav.newSubPackage'), icon: FolderPlus, onSelect: () => startNew(p.id) },
    { label: t('logic.nav.rename'), onSelect: () => startRename(p) },
    { type: 'separator' },
    { label: t('logic.nav.deletePackage'), danger: true, onSelect: () => pk.remove(props.kind, p.id) },
  ]
}

// ── drag & drop ──
const over = ref<string | null>(null)
const canDrop = computed(
  () => (ed.drag?.kind === 'item' || ed.drag?.kind === 'pkg') && ed.drag.itemKind === props.kind,
)
const draggedHasPkg = computed(() => {
  const d = ed.drag
  if (!d || !canDrop.value || (d.kind !== 'pkg' && d.kind !== 'item')) return false
  const id = d.id
  if (d.kind === 'pkg') return !!props.packages.find((p) => p.id === id)?.parent
  return !!props.entries.find((e) => e.id === id)?.package
})
function dragItem(e: DragEvent, id: string) {
  ed.drag = { kind: 'item', itemKind: props.kind, id }
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'
}
function dragPkg(e: DragEvent, id: string) {
  ed.drag = { kind: 'pkg', itemKind: props.kind, id }
  e.dataTransfer?.setData('text/plain', id)
}
function onOver(e: DragEvent, key: string) {
  if (!canDrop.value) return
  e.preventDefault()
  over.value = key
}
function onDrop(e: DragEvent, pkg: string | undefined) {
  e.preventDefault()
  const d = ed.drag
  ed.drag = null
  over.value = null
  if (!d || d.kind === 'new' || d.kind === 'move' || d.itemKind !== props.kind) return
  if (d.kind === 'item') {
    pk.moveItem(props.kind, d.id, pkg)
    if (pkg) ed.togglePkg(pkg, true)
  } else if (d.id !== pkg) pk.movePackage(d.id, pkg)
}
function endDrag() {
  ed.drag = null
  over.value = null
}
</script>

<template>
  <div class="mb-0.5">
    <div class="group/h flex h-8 items-center gap-1 rounded-lg pl-1.5 pr-1 hover:bg-hover">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        :aria-expanded="open"
        @click="open = !open"
      >
        <ChevronRight
          :size="13"
          class="shrink-0 text-faint transition-transform"
          :class="open && 'rotate-90'"
        />
        <PIcon :name="meta.icon" :size="14" :class="toneClasses[meta.tone].fg" />
        <span class="truncate text-base font-bold text-fg">{{ t(`logic.kinds.${kind}`) }}</span>
        <span class="text-xs font-semibold text-faint">{{ entries.length }}</span>
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-faint opacity-0 hover:bg-subtle hover:text-fg focus-visible:opacity-100 group-hover/h:opacity-100"
        :title="t('logic.nav.newPackage')"
        @click="startNew()"
      >
        <FolderPlus :size="13" />
      </button>
      <button
        type="button"
        class="grid size-6 place-items-center rounded-md text-faint opacity-0 hover:bg-subtle hover:text-fg focus-visible:opacity-100 group-hover/h:opacity-100"
        :title="meta.create"
        @click="emit('create')"
      >
        <Plus :size="14" />
      </button>
    </div>

    <div v-if="open" class="flex flex-col">
      <div v-if="editing?.mode === 'new' && !editing.parent" class="flex h-8 items-center gap-1.5 pl-7 pr-2">
        <Folder :size="13" class="shrink-0 text-faint" />
        <input
          v-focus
          v-model="editing.name"
          class="h-7 min-w-0 flex-1 rounded-md border border-primary bg-surface px-1.5 font-mono text-sm outline-none"
          :placeholder="t('logic.nav.packageName')"
          @keydown.enter.prevent="commit"
          @keydown.esc="editing = null"
          @blur="commit"
        />
      </div>

      <template v-for="r in rows" :key="r.key">
        <template v-if="r.k === 'pkg'">
          <div
            :class="
              cn(
                'group/p flex h-8 items-center gap-1.5 rounded-lg pr-1',
                over === r.key ? 'bg-primary-tint ring-1 ring-primary-ring' : 'hover:bg-hover',
              )
            "
            :style="{ paddingLeft: `${22 + r.depth * 14}px` }"
            draggable="true"
            @dragstart="dragPkg($event, r.pkg.id)"
            @dragend="endDrag"
            @dragover="onOver($event, r.key)"
            @dragleave="over === r.key && (over = null)"
            @drop="onDrop($event, r.pkg.id)"
          >
            <template v-if="editing?.mode === 'rename' && editing.id === r.pkg.id">
              <Folder :size="13" class="shrink-0 text-faint" />
              <input
                v-focus
                v-model="editing.name"
                class="h-7 min-w-0 flex-1 rounded-md border border-primary bg-surface px-1.5 font-mono text-sm outline-none"
                @keydown.enter.prevent="commit"
                @keydown.esc="editing = null"
                @blur="commit"
              />
            </template>
            <button
              v-else
              type="button"
              class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              :aria-expanded="r.open"
              @click="ed.togglePkg(r.pkg.id)"
              @dblclick="startRename(r.pkg)"
            >
              <component :is="r.open ? FolderOpen : Folder" :size="13" class="shrink-0 text-faint" />
              <span class="truncate font-mono text-sm font-semibold text-fg-2">{{ r.pkg.name }}</span>
              <span class="text-2xs text-faint">{{ r.count }}</span>
            </button>
            <PMenu :items="pkgMenu(r.pkg)" :width="200">
              <button
                type="button"
                class="grid size-6 place-items-center rounded-md text-faint opacity-0 hover:bg-subtle hover:text-fg focus-visible:opacity-100 group-hover/p:opacity-100 data-[state=open]:opacity-100"
                :aria-label="t('logic.nav.packageActions')"
              >
                <MoreHorizontal :size="13" />
              </button>
            </PMenu>
          </div>
          <div
            v-if="editing?.mode === 'new' && editing.parent === r.pkg.id"
            class="flex h-8 items-center gap-1.5 pr-2"
            :style="{ paddingLeft: `${36 + r.depth * 14}px` }"
          >
            <Folder :size="13" class="shrink-0 text-faint" />
            <input
              v-focus
              v-model="editing.name"
              class="h-7 min-w-0 flex-1 rounded-md border border-primary bg-surface px-1.5 font-mono text-sm outline-none"
              :placeholder="t('logic.nav.packageName')"
              @keydown.enter.prevent="commit"
              @keydown.esc="editing = null"
              @blur="commit"
            />
          </div>
        </template>
        <button
          v-else
          type="button"
          draggable="true"
          :class="
            cn(
              'group/i flex min-h-[38px] w-full items-center gap-2 rounded-lg py-1 pr-2 text-left',
              r.entry.id === activeId ? 'bg-primary-tint' : 'hover:bg-hover',
            )
          "
          :style="{ paddingLeft: `${22 + r.depth * 14}px` }"
          :title="`${r.entry.badge ? `${r.entry.badge} ` : ''}${r.entry.label}\nlogic.${kind}.${r.entry.id}`"
          @click="emit('open', r.entry.id)"
          @dragstart="dragItem($event, r.entry.id)"
          @dragend="endDrag"
        >
          <span class="min-w-0 flex-1">
            <span class="flex min-w-0 items-center gap-1.5">
              <span
                v-if="r.entry.badge"
                :class="
                  cn(
                    'shrink-0 rounded px-1 font-mono text-2xs font-bold leading-4',
                    toneClasses[badgeTone(r.entry)].bg,
                    toneClasses[badgeTone(r.entry)].fg,
                  )
                "
                >{{ r.entry.badge }}</span
              >
              <span
                :class="
                  cn(
                    'truncate text-base font-semibold',
                    r.entry.id === activeId ? 'text-primary-strong' : 'text-fg',
                    kind !== 'crons' && 'font-mono text-sm',
                  )
                "
                >{{ r.entry.label }}</span
              >
            </span>
            <span class="block truncate font-mono text-2xs text-faint"
              >logic.{{ kind }}.{{ r.entry.id }}</span
            >
          </span>
          <span
            v-if="dirty.has(r.entry.id)"
            class="size-1.5 shrink-0 rounded-full bg-warn-dot"
            :title="t('logic.unsaved')"
          />
          <PStatusDot v-if="statuses.get(r.entry.id)" :tone="statuses.get(r.entry.id)" />
        </button>
      </template>

      <div
        v-if="draggedHasPkg"
        :class="
          cn(
            'mx-1 my-1 rounded-lg border-[1.5px] border-dashed px-2 py-2 text-center text-xs',
            over === 'root' ? 'border-primary bg-primary-tint text-primary-strong' : 'border-line text-faint',
          )
        "
        @dragover="onOver($event, 'root')"
        @dragleave="over === 'root' && (over = null)"
        @drop="onDrop($event, undefined)"
      >
        {{ t('logic.nav.dropRoot') }}
      </div>
      <button
        v-if="!entries.length"
        type="button"
        class="mx-1 my-1 rounded-lg border border-dashed border-line px-2 py-2 text-left text-xs text-faint hover:text-primary-strong"
        @click="emit('create')"
      >
        {{ meta.hint }}
      </button>
    </div>
  </div>
</template>
