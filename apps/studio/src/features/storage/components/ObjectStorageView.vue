<script setup lang="ts">
/** One object storage connection: settings, test, disconnect, buckets, keys per environment, "Used by". */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CircleAlert, CircleCheck, Folder, HardDrive, PlugZap, Server, Unplug } from 'lucide-vue-next'
import { PBadge, PButton, PField, PIcon, PInput, PSwitch, PTooltip, toast, toneClasses } from '@platon/ui'
import type {
  AppDefinition,
  ObjectStorage,
  ObjectStorageStatus,
  StorageTestResponse,
} from '@platon/definition'
import { fmtBytes } from '@/composables/format'
import { projectLinks } from '@/composables/useProject'
import { errorMessage } from '@/services/http'
import { testSavedStorage } from '../api'
import { useStorageEdits } from '../useStorageEdits'
import { backedUpFolders, isValidEndpoint, PURPOSES, usedBy } from '../utils'
import BucketsTable from './BucketsTable.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import CredentialsCard from './CredentialsCard.vue'
import StatCard from './StatCard.vue'

const props = defineProps<{
  projectId: string
  definition: AppDefinition
  storage: ObjectStorage
  status?: ObjectStorageStatus
}>()
const { t } = useI18n()
const router = useRouter()
const edits = useStorageEdits()
const links = computed(() => projectLinks(props.projectId))

const purpose = computed(() => PURPOSES[props.storage.purpose ?? 'files'])
const tone = computed(() => toneClasses[purpose.value.tone])
const refs = computed(() => usedBy(props.definition, props.storage.id))
const backups = computed(() => backedUpFolders(props.definition, props.storage.id))

// ── connection settings: edited in place, committed on blur ──
const endpoint = ref('')
const region = ref('')
watch(
  () => [props.storage.endpoint, props.storage.region] as const,
  ([e, r]) => {
    endpoint.value = e
    region.value = r ?? ''
  },
  { immediate: true },
)
const endpointError = computed(() =>
  isValidEndpoint(endpoint.value) ? null : t('storage.connect.err.endpoint'),
)
function commitEndpoint() {
  const v = endpoint.value.trim()
  if (v === props.storage.endpoint) return
  if (!isValidEndpoint(v)) {
    endpoint.value = props.storage.endpoint
    return
  }
  edits.setStorage(props.storage, 'endpoint', v)
}
function commitRegion() {
  const v = region.value.trim()
  if (v !== (props.storage.region ?? '')) edits.setStorage(props.storage, 'region', v)
}

// ── test ──
const testing = ref(false)
const result = ref<StorageTestResponse | null>(null)
watch(
  () => props.storage.id,
  () => (result.value = null),
)
async function test() {
  testing.value = true
  result.value = null
  try {
    result.value = await testSavedStorage(props.projectId, props.storage.id)
  } catch (e) {
    result.value = { ok: false, message: errorMessage(e) }
  } finally {
    testing.value = false
  }
}

// ── disconnect ──
const confirmOpen = ref(false)
function disconnect() {
  const name = props.storage.name
  if (edits.removeStorage(props.storage)) {
    confirmOpen.value = false
    toast(t('storage.object.disconnected', { name }))
    void router.push(links.value.storage())
  }
}

function openBucket(bucket: string) {
  void router.push({ ...links.value.storage('object', props.storage.id), query: { bucket } })
}

function openRef(r: (typeof refs.value)[number]) {
  if (r.kind === 'field' && r.tableId) void router.push(links.value.data(r.connectionId, r.tableId))
  else if (r.functionId) void router.push(links.value.logic('functions', r.functionId))
}
</script>

<template>
  <div>
    <!-- header -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="grid size-10 place-items-center rounded-[10px]" :class="[tone.bg, tone.fg]">
        <PIcon :name="purpose.icon" :size="19" />
      </div>
      <div class="min-w-0">
        <h1 class="m-0 truncate text-[22px] font-extrabold tracking-tight">{{ storage.name }}</h1>
        <div class="mt-0.5 font-mono text-xs text-faint">storage.{{ storage.id }}</div>
      </div>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <PBadge :tone="purpose.tone"
          ><PIcon :name="purpose.icon" :size="12" />{{
            t(`storage.purpose.${storage.purpose ?? 'files'}.label`)
          }}</PBadge
        >
        <PBadge :icon="Server">{{
          storage.provider === 'minio' ? t('storage.provider.minio') : t('storage.provider.s3')
        }}</PBadge>
        <PTooltip :text="t('storage.object.disconnect')">
          <PButton
            square
            variant="danger"
            :icon="Unplug"
            :label="t('storage.object.disconnect')"
            @click="confirmOpen = true"
          />
        </PTooltip>
        <PButton :icon="PlugZap" :loading="testing" @click="test">{{ t('storage.object.test') }}</PButton>
      </div>
    </div>
    <div
      v-if="result"
      role="status"
      class="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold"
      :class="result.ok ? 'bg-ok-bg text-ok' : 'bg-danger-bg text-danger'"
    >
      <component :is="result.ok ? CircleCheck : CircleAlert" :size="14" />
      {{ result.message
      }}<span v-if="result.latencyMs" class="font-normal opacity-80"
        >· {{ result.latencyMs }} ms · {{ t('storage.env.development') }}</span
      >
    </div>

    <!-- connection -->
    <div
      class="mb-7 mt-5 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5 max-[1180px]:grid-cols-2"
    >
      <div class="rounded-xl border border-line-2 bg-surface px-4 py-3">
        <PField v-slot="{ id }" :label="t('storage.connect.endpoint')" :error="endpointError">
          <PInput
            :id="id"
            v-model="endpoint"
            size="sm"
            mono
            :invalid="!!endpointError"
            @blur="commitEndpoint"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
        </PField>
      </div>
      <div class="rounded-xl border border-line-2 bg-surface px-4 py-3">
        <PField v-slot="{ id }" :label="t('storage.connect.region')">
          <PInput
            :id="id"
            v-model="region"
            size="sm"
            mono
            placeholder="us-east-1"
            @blur="commitRegion"
            @keydown.enter="($event.target as HTMLInputElement).blur()"
          />
        </PField>
      </div>
      <div class="rounded-xl border border-line-2 bg-surface px-4 py-3">
        <div class="mb-1.5 text-sm font-semibold text-fg-2">{{ t('storage.object.connection') }}</div>
        <div class="flex h-[30px] items-center gap-2 text-base">
          <PSwitch
            :model-value="!!storage.tls"
            :label="t('storage.connect.tls')"
            @update:model-value="(v) => edits.setStorage(storage, 'tls', v)"
          />
          <span :class="storage.tls ? 'text-ok' : 'text-warn'" class="font-semibold">{{
            storage.tls ? t('storage.object.tlsOn') : t('storage.object.tlsOff')
          }}</span>
        </div>
      </div>
      <StatCard
        :label="t('storage.object.stored')"
        :value="status ? fmtBytes(status.totalBytes) : '…'"
        :icon="HardDrive"
      />
    </div>

    <BucketsTable :storage="storage" :stats="status?.buckets" @open="openBucket" />

    <div class="mt-7 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
      <CredentialsCard :project-id="projectId" :storage="storage" :hints="status?.credentials" />
      <section>
        <h2 class="mb-2.5 text-xl font-bold">{{ t('storage.usedBy.title') }}</h2>
        <div class="overflow-hidden rounded-xl border border-line-2 bg-surface">
          <button
            v-for="r in refs"
            :key="r.label"
            type="button"
            class="flex w-full items-center gap-2.5 border-b border-line-faint px-4 py-3 text-left last:border-b-0 hover:bg-hover"
            @click="openRef(r)"
          >
            <span class="grid size-[30px] shrink-0 place-items-center rounded-lg bg-subtle text-fg-2"
              ><PIcon :name="r.icon" :size="14"
            /></span>
            <span class="min-w-0 flex-1 truncate text-md font-semibold">{{ r.label }}</span>
            <span class="text-xs text-faint">{{
              r.kind === 'field' ? t('storage.usedBy.field') : t('storage.usedBy.function')
            }}</span>
          </button>
          <button
            v-for="f in backups"
            :key="f.id"
            type="button"
            class="flex w-full items-center gap-2.5 border-b border-line-faint px-4 py-3 text-left last:border-b-0 hover:bg-hover"
            @click="router.push(links.storage('local', f.id))"
          >
            <span class="grid size-[30px] shrink-0 place-items-center rounded-lg bg-warn-bg text-warn"
              ><Folder :size="14"
            /></span>
            <span class="min-w-0 flex-1 truncate font-mono text-sm font-semibold">{{ f.path }}/</span>
            <span class="text-xs text-faint">{{ t('storage.usedBy.backup') }}</span>
          </button>
          <p
            v-if="!refs.length && !backups.length"
            class="m-0 px-4 py-4 text-base leading-relaxed text-faint"
          >
            {{ t('storage.usedBy.none') }}
          </p>
        </div>
      </section>
    </div>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('storage.object.disconnectTitle', { name: storage.name })"
      :description="t('storage.object.disconnectBody')"
      :confirm-label="t('storage.object.disconnect')"
      @confirm="disconnect"
    >
      <p
        v-if="refs.length || backups.length"
        class="m-0 flex gap-2 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn"
      >
        <CircleAlert :size="14" class="mt-0.5 shrink-0" />
        {{
          t(
            'storage.object.disconnectUsed',
            { n: refs.length + backups.length },
            refs.length + backups.length,
          )
        }}
      </p>
    </ConfirmDialog>
  </div>
</template>
