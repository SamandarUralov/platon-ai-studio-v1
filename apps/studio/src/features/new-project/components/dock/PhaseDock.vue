<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { AlertCircle, ArrowLeft, ArrowRight, Plus, RotateCw, Sparkles } from 'lucide-vue-next'
import { PButton, PSpinner } from '@platon/ui'
import { BUILD_TASKS, useFlow } from '../../flow'
import { useAnswerText } from '../../useAnswerText'
import QuestionDock from './QuestionDock.vue'

const flow = useFlow()
const router = useRouter()
const { t } = useAnswerText(flow)
const s = flow.state

const name = computed(() => s.name.trim() || s.brief?.name || '')
const pct = computed(() => Math.min(100, Math.round((s.gen / BUILD_TASKS.length) * 100)))
const brandStyle = computed(() => ({ background: flow.theme.value.hex }))

function openStudio() {
  if (s.result) void router.push({ name: 'interface', params: { projectId: s.result.id } })
}
</script>

<template>
  <!-- One card whose content follows the phase, like a chat composer. -->
  <div class="mx-auto max-w-[760px] overflow-hidden rounded-[20px] border border-line bg-surface shadow-pop">
    <div v-if="s.phase === 'reading'" class="flex items-center gap-3 px-5 py-[18px]" role="status">
      <PSpinner :size="18" class="text-primary" />
      <div class="flex-1 text-lg font-semibold">
        {{ s.thinking ? t('newProject.dock.summarising') : t('newProject.feed.reading') }}
      </div>
      <PButton variant="primary" size="lg" :icon-right="ArrowRight" disabled>{{
        t('newProject.dock.next')
      }}</PButton>
    </div>

    <template v-else-if="s.phase === 'brief'">
      <div class="flex flex-col gap-1 px-5 pt-[18px]">
        <h2 class="text-[17px] font-bold tracking-[-0.01em]">{{ t('newProject.dock.briefTitle') }}</h2>
        <p class="text-base text-faint">{{ t('newProject.dock.briefHint') }}</p>
      </div>
      <form class="flex gap-2 px-5 pt-3.5" @submit.prevent="flow.addRequirement()">
        <input
          v-model="s.newReq"
          data-own-enter
          :placeholder="t('newProject.dock.addReq')"
          :aria-label="t('newProject.dock.addReq')"
          class="h-[42px] flex-1 rounded-[11px] border border-line bg-subtle-2 px-3.5 text-lg outline-none placeholder:text-faint-2 focus:border-primary focus:bg-surface focus:shadow-focus"
        />
        <PButton type="submit" size="lg" class="h-[42px]" :icon="Plus" :disabled="!s.newReq.trim()">{{
          t('newProject.dock.add')
        }}</PButton>
      </form>
      <div class="flex items-center gap-2.5 px-5 pb-[18px] pt-4">
        <span class="text-sm text-faint-2">{{
          t('newProject.dock.reqSummary', { n: flow.inScope.value }, flow.inScope.value)
        }}</span>
        <PButton
          variant="primary"
          size="lg"
          class="ml-auto h-[42px]"
          :icon-right="ArrowRight"
          @click="flow.continueBrief"
          >{{ t('newProject.dock.looksRight') }}</PButton
        >
      </div>
    </template>

    <QuestionDock v-else-if="s.phase === 'q'" />

    <div v-else-if="s.phase === 'summary'" class="flex flex-wrap items-center gap-3 px-5 py-4">
      <div class="min-w-[220px] flex-1">
        <h2 class="text-[16px] font-bold">{{ t('newProject.dock.readyTitle', { name }) }}</h2>
        <p class="mt-0.5 text-base text-faint">{{ t('newProject.dock.readyHint') }}</p>
      </div>
      <PButton size="lg" class="h-11" :icon="ArrowLeft" @click="flow.back">{{
        t('newProject.dock.back')
      }}</PButton>
      <!-- Brand-coloured CTA previews the chosen theme; colour is user data. -->
      <button
        type="button"
        class="flex h-11 items-center gap-2 rounded-xl px-[22px] text-[14.5px] font-bold text-white hover:brightness-110"
        :style="brandStyle"
        @click="flow.create"
      >
        <Sparkles :size="16" aria-hidden="true" />{{ t('newProject.dock.create') }}
      </button>
    </div>

    <div
      v-else-if="s.phase === 'building' && s.buildError"
      class="flex flex-wrap items-center gap-3 px-5 py-4"
      role="alert"
    >
      <span class="grid size-9 place-items-center rounded-[10px] bg-danger-bg text-danger"
        ><AlertCircle :size="18" aria-hidden="true"
      /></span>
      <div class="min-w-[200px] flex-1">
        <div class="text-[15px] font-bold">{{ t('newProject.dock.failed', { name }) }}</div>
        <div class="mt-0.5 text-base text-danger">{{ s.buildError }}</div>
      </div>
      <PButton variant="primary" size="lg" :icon="RotateCw" @click="flow.retry">{{
        t('newProject.dock.retry')
      }}</PButton>
    </div>

    <div v-else-if="s.phase === 'building'" class="flex flex-col gap-2.5 px-5 py-[18px]" role="status">
      <div class="flex items-center gap-2.5">
        <PSpinner :size="16" class="text-primary" />
        <div class="text-[14.5px] font-semibold">{{ t('newProject.dock.creating', { name }) }}</div>
        <span class="ml-auto text-base font-bold text-primary">{{ pct }}%</span>
      </div>
      <div
        class="h-1.5 overflow-hidden rounded-[3px] bg-subtle"
        role="progressbar"
        :aria-valuenow="pct"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-[3px] bg-primary transition-[width] duration-500 ease-out"
          :style="{ width: `${pct}%` }"
        />
      </div>
    </div>

    <div v-else-if="s.phase === 'done'" class="flex flex-wrap items-center gap-3.5 px-5 py-4">
      <div
        class="grid size-[42px] shrink-0 place-items-center rounded-xl text-[18px] font-extrabold text-white"
        :style="brandStyle"
      >
        {{ name.charAt(0).toUpperCase() }}
      </div>
      <div class="min-w-[200px] flex-1">
        <h2 class="text-[16px] font-bold">
          {{ t('newProject.dock.readyDone', { name: s.result?.name ?? name }) }}
        </h2>
        <p class="mt-0.5 text-base text-faint">{{ t('newProject.dock.doneHint') }}</p>
      </div>
      <PButton
        variant="ink"
        size="lg"
        class="h-11 px-5"
        :icon-right="ArrowRight"
        data-autofocus
        @click="openStudio"
        >{{ t('newProject.dock.open') }}</PButton
      >
    </div>
  </div>
</template>
