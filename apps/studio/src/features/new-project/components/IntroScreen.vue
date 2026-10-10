<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRight, Paperclip, Sparkles, X } from 'lucide-vue-next'
import { PButton, PIcon, PKbd, cn } from '@platon/ui'
import { fmtBytes } from '@/composables/format'
import { kbd } from '@/composables/useShortcuts'
import { EXAMPLES } from '../catalog'
import { useFlow } from '../flow'
import { useAnswerText } from '../useAnswerText'
import FileBadge from './FileBadge.vue'
import FileDropZone from './FileDropZone.vue'

const flow = useFlow()
const { t } = useAnswerText(flow)
const s = flow.state
const box = ref<HTMLTextAreaElement | null>(null)

function useExample(id: (typeof EXAMPLES)[number]['id']) {
  s.input = t(`newProject.examples.${id}.text`)
  box.value?.focus()
}
onMounted(() => box.value?.focus())
</script>

<template>
  <div class="scroll-thin flex-1 overflow-auto">
    <div class="flex min-h-full flex-col items-center px-6 py-10">
      <div class="my-auto flex w-full max-w-[720px] animate-rise flex-col gap-7">
        <div class="flex flex-col items-center gap-3 text-center">
          <div class="grid size-[52px] place-items-center rounded-2xl bg-ink text-on-ink">
            <Sparkles :size="22" aria-hidden="true" />
          </div>
          <h1 class="mt-1.5 text-balance text-[40px] font-extrabold leading-[1.1] tracking-[-0.03em]">
            {{ t('newProject.intro.title') }}
          </h1>
          <p class="max-w-[500px] text-pretty text-[16px] leading-relaxed text-muted">
            {{ t('newProject.intro.lead') }}
          </p>
        </div>

        <FileDropZone v-slot="{ dragging, pick }" @files="flow.addFiles">
          <div
            :class="
              cn(
                'overflow-hidden rounded-[20px] border-[1.5px] bg-surface shadow-card transition-colors',
                dragging ? 'border-primary' : 'border-line',
              )
            "
          >
            <textarea
              ref="box"
              v-model="s.input"
              rows="4"
              :placeholder="t('newProject.intro.placeholder')"
              :aria-label="t('newProject.intro.describe')"
              class="block w-full resize-none bg-transparent px-[22px] pb-2.5 pt-5 text-[16px] leading-relaxed outline-none placeholder:text-faint-2"
            />
            <div v-if="s.staged.length || dragging" class="flex flex-col gap-2 px-4 pb-3">
              <div
                v-for="f in s.staged"
                :key="f.id"
                class="flex items-center gap-3 rounded-xl border border-line-soft bg-subtle-2 py-2 pl-2.5 pr-2"
              >
                <FileBadge :kind="f.kind" :badge="f.badge" />
                <div class="min-w-0 flex-1">
                  <div class="truncate text-md font-semibold">{{ f.name }}</div>
                  <div class="text-sm text-faint">{{ fmtBytes(f.size) }}</div>
                </div>
                <PButton
                  variant="ghost"
                  square
                  size="sm"
                  :icon="X"
                  :label="t('newProject.intro.remove', { name: f.name })"
                  @click="flow.removeFile(f.id)"
                />
              </div>
              <div
                v-if="dragging"
                class="grid h-14 place-items-center rounded-xl border-[1.5px] border-dashed border-primary bg-primary-tint text-md font-semibold text-primary-strong"
              >
                {{ t('newProject.intro.dropHere') }}
              </div>
            </div>
            <div class="flex items-center gap-2.5 border-t border-line-faint py-3 pl-4 pr-3.5">
              <PButton size="lg" :icon="Paperclip" @click="pick">{{
                t('newProject.intro.addFiles')
              }}</PButton>
              <span class="text-sm text-faint-2">{{ t('newProject.intro.dropHint') }}</span>
              <span class="ml-auto hidden items-center gap-1 text-sm text-faint-2 sm:flex"
                ><PKbd>{{ kbd('mod+enter') }}</PKbd></span
              >
              <PButton
                variant="primary"
                size="lg"
                :icon-right="ArrowRight"
                :disabled="!flow.canStart.value"
                @click="flow.start"
              >
                {{ t('newProject.intro.continue') }}
              </PButton>
            </div>
          </div>
        </FileDropZone>

        <div class="flex flex-col items-center gap-2.5">
          <div class="text-sm font-semibold text-faint-2">{{ t('newProject.intro.orIdea') }}</div>
          <div class="flex flex-wrap justify-center gap-2">
            <button
              v-for="ex in EXAMPLES"
              :key="ex.id"
              type="button"
              class="flex h-9 items-center gap-[7px] rounded-full border border-line bg-surface px-3.5 text-base font-semibold text-fg-2 hover:border-primary hover:text-primary-strong"
              @click="useExample(ex.id)"
            >
              <PIcon :name="ex.icon" :size="14" />{{ t(`newProject.examples.${ex.id}.label`) }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
