<script setup lang="ts">
/** Landing view: one card per object storage plus the local disk summary. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Cloud, Globe, HardDrive, Lock, LockOpen, MapPin, Plus, Server, TriangleAlert } from 'lucide-vue-next'
import { PBadge, PButton, PIcon, PSpinner, toneClasses } from '@platon/ui'
import type { AppDefinition, LocalStorageStatus, ObjectStorageStatus } from '@platon/definition'
import { fmtBytes } from '@/composables/format'
import { projectLinks } from '@/composables/useProject'
import { hostOf, isNearFull, missingCredentials, PURPOSES, usagePct } from '../utils'
import UsageBar from './UsageBar.vue'

const props = defineProps<{
  projectId: string
  definition: AppDefinition
  status?: ObjectStorageStatus[]
  local?: LocalStorageStatus
  localLoading?: boolean
}>()
const emit = defineEmits<{ connect: [] }>()
const { t } = useI18n()
const router = useRouter()
const links = computed(() => projectLinks(props.projectId))

const cards = computed(() =>
  props.definition.storage.object.map((st) => {
    const p = PURPOSES[st.purpose ?? 'files']
    const s = props.status?.find((x) => x.id === st.id)
    return {
      st,
      p,
      tone: toneClasses[p.tone],
      total: s?.totalBytes,
      objects: s?.buckets.reduce((n, b) => n + b.objects, 0),
      missing: missingCredentials(st),
    }
  }),
)
const diskWarn = computed(() => !!props.local && isNearFull(props.local.usedBytes, props.local.totalBytes))
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end gap-3">
      <div>
        <h1 class="m-0 text-[22px] font-extrabold tracking-tight">{{ t('storage.overview.title') }}</h1>
        <p class="mt-1 text-md text-muted">{{ t('storage.overview.sub') }}</p>
      </div>
      <PButton class="ml-auto" variant="primary" :icon="Plus" @click="emit('connect')">{{
        t('storage.connect.title')
      }}</PButton>
    </div>

    <h2 class="mb-2.5 mt-7 flex items-center gap-2 text-xl font-bold">
      <Cloud :size="16" class="text-muted" aria-hidden="true" />{{ t('storage.object.section') }}
      <span class="text-sm font-medium text-faint">{{ cards.length }}</span>
    </h2>
    <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
      <button
        v-for="c in cards"
        :key="c.st.id"
        type="button"
        class="flex min-w-0 flex-col gap-3 rounded-xl border border-line-2 bg-surface p-4 text-left transition-shadow hover:shadow-card focus-visible:outline-2"
        @click="router.push(links.storage('object', c.st.id))"
      >
        <div class="flex items-center gap-3">
          <div
            class="grid size-10 shrink-0 place-items-center rounded-[10px]"
            :class="[c.tone.bg, c.tone.fg]"
          >
            <PIcon :name="c.p.icon" :size="18" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-lg font-bold">{{ c.st.name }}</div>
            <div class="truncate text-sm text-faint">
              {{ t(`storage.purpose.${c.st.purpose ?? 'files'}.label`) }} ·
              {{ c.st.provider === 'minio' ? 'MinIO' : 'Amazon S3' }}
            </div>
          </div>
          <PBadge v-if="c.missing.length" tone="warn" dot size="xs">{{
            t('storage.object.needsKeys')
          }}</PBadge>
          <PBadge v-else tone="ok" dot size="xs">{{ t('storage.object.connected') }}</PBadge>
        </div>
        <div class="grid gap-1.5 text-sm text-fg-2">
          <div class="flex min-w-0 items-center gap-2">
            <Globe :size="13" class="shrink-0 text-faint" /><span class="truncate font-mono text-xs">{{
              hostOf(c.st.endpoint)
            }}</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="flex items-center gap-2"
              ><MapPin :size="13" class="text-faint" /><span class="font-mono text-xs">{{
                c.st.region || '—'
              }}</span></span
            >
            <span class="flex items-center gap-1.5">
              <component
                :is="c.st.tls ? Lock : LockOpen"
                :size="13"
                :class="c.st.tls ? 'text-ok' : 'text-warn'"
              />{{ c.st.tls ? t('storage.object.tlsOn') : t('storage.object.tlsOff') }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-4 border-t border-line-faint pt-3 text-sm">
          <span
            ><b class="font-bold">{{ c.st.buckets.length }}</b>
            <span class="text-muted">{{ t('storage.object.buckets', c.st.buckets.length) }}</span></span
          >
          <span v-if="c.objects !== undefined"
            ><b class="font-bold">{{ c.objects.toLocaleString() }}</b>
            <span class="text-muted">{{ t('storage.object.objects', c.objects) }}</span></span
          >
          <span class="ml-auto font-bold">{{ c.total !== undefined ? fmtBytes(c.total) : '…' }}</span>
        </div>
      </button>
      <button
        type="button"
        class="grid min-h-[170px] place-items-center rounded-xl border border-dashed border-line text-muted hover:border-primary-ring hover:bg-hover hover:text-primary-strong"
        @click="emit('connect')"
      >
        <span class="flex flex-col items-center gap-1.5 text-base font-semibold"
          ><Plus :size="18" />{{ t('storage.connect.title') }}</span
        >
      </button>
    </div>

    <h2 class="mb-2.5 mt-8 flex items-center gap-2 text-xl font-bold">
      <Server :size="16" class="text-muted" aria-hidden="true" />{{ t('storage.local.section') }}
    </h2>
    <button
      type="button"
      class="block w-full rounded-xl border border-line-2 bg-surface p-4 text-left transition-shadow hover:shadow-card focus-visible:outline-2"
      @click="router.push(links.storage('local'))"
    >
      <div class="flex flex-wrap items-center gap-3">
        <div class="grid size-10 shrink-0 place-items-center rounded-[10px] bg-warn-bg text-warn">
          <HardDrive :size="18" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-lg font-bold">
            {{ local ? `${local.host} · ${local.os}` : t('storage.local.title') }}
          </div>
          <div class="font-mono text-xs text-faint">{{ definition.storage.local.root }}</div>
        </div>
        <div class="text-right">
          <div class="text-lg font-bold">
            {{ local ? `${usagePct(local.usedBytes, local.totalBytes)}%` : '' }}
          </div>
          <div class="text-sm text-muted">
            {{
              local
                ? t('storage.local.diskOf', {
                    used: fmtBytes(local.usedBytes),
                    total: fmtBytes(local.totalBytes),
                  })
                : ''
            }}
          </div>
        </div>
      </div>
      <div v-if="localLoading" class="mt-3 grid place-items-center"><PSpinner /></div>
      <UsageBar
        v-else-if="local"
        class="mt-3"
        :used="local.usedBytes"
        :total="local.totalBytes"
        :label="t('storage.local.diskUsage')"
      />
      <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>{{
          t(
            'storage.local.folderCount',
            { n: definition.storage.local.folders.length },
            definition.storage.local.folders.length,
          )
        }}</span>
        <span v-if="diskWarn" class="flex items-center gap-1.5 font-semibold text-warn"
          ><TriangleAlert :size="13" />{{ t('storage.local.diskWarn') }}</span
        >
      </div>
      <div class="mt-3 flex gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm leading-relaxed text-warn">
        <TriangleAlert :size="14" class="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{{ t('storage.local.noReplicationShort') }}</span>
      </div>
    </button>
  </div>
</template>
