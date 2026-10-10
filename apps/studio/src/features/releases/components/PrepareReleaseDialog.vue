<script setup lang="ts">
/** "Prepare a release": name, note, target and a preview of exactly what will happen, then live progress. */
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Database, HardDrive, ListChecks, Rocket, ShieldCheck, UserCheck } from 'lucide-vue-next'
import { ENVIRONMENTS, type DeploymentJob, type EnvName } from '@platon/definition'
import {
  PButton,
  PDialog,
  PField,
  PInput,
  PSegmented,
  PSpinner,
  PTextarea,
  toast,
  type SegmentOption,
} from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import { useSessionStore } from '@/stores/session'
import { errorMessage } from '@/services/http'
import { useReleaseCommands, useReleasePreview } from '../api'
import MigrationList from './MigrationList.vue'
import DeployProgress from './DeployProgress.vue'

const props = defineProps<{ projectId: string; initialTarget?: EnvName }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ released: [releaseId: string] }>()
const { t } = useI18n()
const def = useDefinitionStore()
const session = useSessionStore()
const cmd = useReleaseCommands(toRef(props, 'projectId'))
const preview = useReleasePreview(toRef(props, 'projectId'), open)

const phase = ref<'form' | 'progress'>('form')
const name = ref('')
const note = ref('')
const target = ref<EnvName>('staging')
const busy = ref(false)
const jobId = ref<string | null>(null)
const finished = ref<DeploymentJob | null>(null)

watch(open, (o) => {
  if (!o) return
  phase.value = 'form'
  name.value = ''
  note.value = ''
  jobId.value = null
  finished.value = null
  target.value = props.initialTarget ?? 'staging'
  void preview.refetch()
})
watch(
  () => preview.data.value?.suggestedName,
  (s) => {
    if (s && !name.value) name.value = s
  },
  { immediate: true },
)

const envOptions = computed<SegmentOption<EnvName>[]>(() =>
  ENVIRONMENTS.map((e) => ({ value: e.id, label: t(`releases.env.${e.id}`) })),
)
const envLabel = computed(() => t(`releases.env.${target.value}`))
const needsApproval = computed(() => target.value === 'production' && !session.canDeployProduction)
const blocked = computed(() => def.errorCount > 0)
const empty = computed(() => (preview.data.value?.changeCount ?? def.changes.length) === 0)
const nameError = computed(() => (name.value.trim() ? null : t('releases.nameRequired')))
const canSubmit = computed(
  () => !busy.value && !blocked.value && !empty.value && !nameError.value && !preview.isLoading.value,
)
const cta = computed(() =>
  needsApproval.value
    ? t('releases.requestApproval')
    : t('releases.releaseTo', { name: name.value.trim(), env: envLabel.value }),
)

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  try {
    const release = await cmd.create({
      name: name.value.trim(),
      ...(note.value.trim() ? { note: note.value.trim() } : {}),
    })
    void def.refreshChanges()
    emit('released', release.id)
    const job = await cmd.deploy(release.id, target.value)
    jobId.value = job.id
    phase.value = 'progress'
  } catch (e) {
    toast(errorMessage(e), { tone: 'danger' })
  } finally {
    busy.value = false
    void cmd.invalidate()
  }
}

function onFinished(j: DeploymentJob) {
  finished.value = j
  void cmd.invalidate()
}
</script>

<template>
  <PDialog
    v-model:open="open"
    :title="
      phase === 'form'
        ? t('releases.prepareTitle')
        : t('releases.deployingTitle', { name: name, env: envLabel })
    "
    :description="
      phase === 'form'
        ? t(
            'releases.prepareSub',
            { n: preview.data.value?.changeCount ?? def.changes.length },
            preview.data.value?.changeCount ?? def.changes.length,
          )
        : undefined
    "
    :icon="Rocket"
    :width="620"
  >
    <template v-if="phase === 'form'">
      <div class="flex flex-wrap gap-3">
        <PField :label="t('releases.version')" :error="nameError" class="min-w-[140px] flex-1">
          <template #default="{ id }">
            <PInput :id="id" v-model="name" mono :invalid="!!nameError" />
          </template>
        </PField>
        <PField :label="t('releases.releaseToLabel')" class="min-w-[260px] flex-[2]">
          <PSegmented
            v-model="target"
            :options="envOptions"
            block
            :aria-label="t('releases.releaseToLabel')"
          />
        </PField>
      </div>
      <PField :label="t('releases.note')" class="mt-3">
        <template #default="{ id }">
          <PTextarea :id="id" v-model="note" :placeholder="t('releases.notePlaceholder')" rows="2" />
        </template>
      </PField>

      <div class="mt-4 overflow-hidden rounded-xl border border-line-2">
        <div class="border-b border-line-faint bg-subtle px-3.5 py-2 text-sm font-bold">
          {{ t('releases.whatHappens') }}
        </div>
        <div v-if="preview.isLoading.value" class="flex items-center gap-2 px-3.5 py-4 text-muted">
          <PSpinner :size="13" />{{ t('releases.computing') }}
        </div>
        <ol v-else class="m-0 list-none p-0">
          <li class="flex gap-3 border-b border-line-faint px-3.5 py-2.5">
            <ListChecks
              :size="15"
              class="mt-0.5 shrink-0"
              :class="blocked ? 'text-danger' : 'text-primary'"
            />
            <div class="text-base" :class="blocked && 'text-danger'">
              <b>{{ t('releases.step.validate') }}</b> ·
              {{
                blocked
                  ? t('releases.validateBlocked', { n: def.errorCount }, def.errorCount)
                  : t('releases.validateOk')
              }}
            </div>
          </li>
          <li class="flex gap-3 border-b border-line-faint px-3.5 py-2.5">
            <Database :size="15" class="mt-0.5 shrink-0 text-teal" />
            <div class="min-w-0 flex-1 text-base">
              <b>{{ t('releases.step.migrations') }}</b> ·
              {{
                preview.data.value?.migrations.length
                  ? t(
                      'releases.migrationsN',
                      { n: preview.data.value.migrations.length },
                      preview.data.value.migrations.length,
                    )
                  : t('releases.noMigrations')
              }}
              <div v-if="preview.data.value?.migrations.length" class="mt-2">
                <MigrationList :migrations="preview.data.value.migrations" :provisioning="[]" />
                <p class="m-0 mt-1.5 text-xs text-muted">
                  {{ t('releases.migrationsHint', { env: envLabel }) }}
                </p>
              </div>
            </div>
          </li>
          <li class="flex gap-3 border-b border-line-faint px-3.5 py-2.5">
            <HardDrive :size="15" class="mt-0.5 shrink-0 text-ok" />
            <div class="min-w-0 flex-1 text-base">
              <b>{{ t('releases.step.provisioning') }}</b> ·
              {{
                preview.data.value?.provisioning.length
                  ? t(
                      'releases.provisioningN',
                      { n: preview.data.value.provisioning.length },
                      preview.data.value.provisioning.length,
                    )
                  : t('releases.noProvisioning')
              }}
              <div v-if="preview.data.value?.provisioning.length" class="mt-2">
                <MigrationList :migrations="[]" :provisioning="preview.data.value.provisioning" />
              </div>
            </div>
          </li>
          <li class="flex gap-3 px-3.5 py-2.5">
            <Rocket :size="15" class="mt-0.5 shrink-0 text-primary" />
            <div class="text-base">
              <b>{{ t('releases.step.deploy') }}</b> · {{ t('releases.deployHint', { env: envLabel }) }}
            </div>
          </li>
        </ol>
      </div>

      <div
        class="mt-3 flex items-start gap-2.5 rounded-xl border border-purple/30 bg-purple-bg px-3.5 py-2.5 text-sm text-purple"
      >
        <ShieldCheck :size="15" class="mt-0.5 shrink-0" />
        <span>{{ t('releases.recordsStay', { env: envLabel }) }}</span>
      </div>
      <div
        v-if="target === 'production'"
        class="mt-2 flex items-start gap-2.5 rounded-xl border border-line-2 bg-subtle px-3.5 py-2.5 text-sm text-fg-2"
      >
        <UserCheck :size="15" class="mt-0.5 shrink-0" />
        <span>{{
          needsApproval
            ? t('releases.approvalNeeded')
            : t('releases.approvalYou', { role: session.user?.role ?? '' })
        }}</span>
      </div>
    </template>

    <template v-else-if="jobId">
      <DeployProgress :project-id="projectId" :job-id="jobId" @finished="onFinished" />
      <div class="mt-4 flex items-start gap-2.5 rounded-xl bg-subtle px-3.5 py-2.5 text-sm text-muted">
        <ShieldCheck :size="15" class="mt-0.5 shrink-0" />
        <span>{{ t('releases.recordsStay', { env: envLabel }) }}</span>
      </div>
    </template>

    <template #footer="{ close }">
      <template v-if="phase === 'form'">
        <PButton @click="close">{{ t('releases.cancel') }}</PButton>
        <PButton
          variant="primary"
          size="md"
          :icon="needsApproval ? UserCheck : Rocket"
          :disabled="!canSubmit"
          :loading="busy"
          @click="submit"
          >{{ cta }}</PButton
        >
      </template>
      <template v-else>
        <span v-if="!finished" class="mr-auto text-sm text-muted">{{ t('releases.canClose') }}</span>
        <PButton :variant="finished ? 'primary' : 'outline'" @click="close">{{
          finished ? t('releases.done') : t('releases.hide')
        }}</PButton>
      </template>
    </template>
  </PDialog>
</template>
