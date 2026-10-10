<script setup lang="ts">
import { Keyboard } from 'lucide-vue-next'
import { PDialog, PKbd } from '@platon/ui'
import { useUiStore } from '@/stores/ui'
import { kbd } from '@/composables/useShortcuts'

const ui = useUiStore()
const GROUPS: [string, [string, string][]][] = [
  [
    'Anywhere',
    [
      ['mod+k', 'Quick switcher'],
      ['alt+1', 'Jump to pin 1–9'],
      ['mod+/', 'Keyboard shortcuts'],
      ['ctrl+`', 'Console, tests and terminal'],
      ['mod+z', 'Undo'],
      ['mod+shift+z', 'Redo'],
    ],
  ],
  [
    'Panels',
    [
      ['mod+,', 'Toggle left panel'],
      ['mod+.', 'Toggle right panel'],
      ['mod+\\', 'Focus mode (hide both)'],
    ],
  ],
  [
    'Interface',
    [
      ['mod+e', 'Design ↔ Code'],
      ['mod+=', 'Zoom in'],
      ['mod+-', 'Zoom out'],
      ['mod+0', 'Reset zoom'],
      ['space', 'Hold and drag to pan'],
    ],
  ],
  [
    'Editors',
    [
      ['mod+s', 'Save'],
      ['mod+enter', 'Run SQL / test'],
      ['ctrl+space', 'Autocomplete'],
    ],
  ],
  [
    'Studio AI',
    [
      ['/', 'Skills'],
      ['@', 'Attach context'],
    ],
  ],
]
</script>

<template>
  <PDialog v-model:open="ui.shortcutsOpen" title="Keyboard shortcuts" :icon="Keyboard" :width="640">
    <div class="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
      <section v-for="[title, rows] in GROUPS" :key="title">
        <h3 class="eyebrow mb-2">{{ title }}</h3>
        <div
          v-for="[k, label] in rows"
          :key="k"
          class="flex h-8 items-center justify-between border-b border-line-faint text-base"
        >
          <span class="text-fg-2">{{ label }}</span>
          <PKbd>{{ k === 'space' ? 'Space' : k === '/' || k === '@' ? k : kbd(k) }}</PKbd>
        </div>
      </section>
    </div>
  </PDialog>
</template>
