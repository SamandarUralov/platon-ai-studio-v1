<script setup lang="ts">
/** Left navigator: object storage connections → buckets, local root → folders. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Plus } from 'lucide-vue-next'
import { PButton } from '@platon/ui'
import { parseSize, type AppDefinition, type LocalStorageStatus } from '@platon/definition'
import NavItem from '@/components/common/NavItem.vue'
import PanelHeader from '@/components/shell/PanelHeader.vue'
import SectionLabel from '@/components/common/SectionLabel.vue'
import { fmtBytes } from '@/composables/format'
import { projectLinks } from '@/composables/useProject'
import { isNearFull, missingCredentials, PURPOSES } from '../utils'

const props = defineProps<{
  projectId: string
  definition: AppDefinition
  local?: LocalStorageStatus
  kind?: 'object' | 'local'
  itemId?: string
  bucket?: string
}>()
const emit = defineEmits<{ connect: []; addFolder: [] }>()
const { t } = useI18n()
const router = useRouter()
const links = computed(() => projectLinks(props.projectId))

const storages = computed(() => props.definition.storage.object)
const folders = computed(() =>
  props.definition.storage.local.folders.map((f) => {
    const used = props.local?.folders.find((x) => x.id === f.id)?.usedBytes
    const quota = parseSize(f.quota)
    return { f, used, quota, warn: used !== undefined && isNearFull(used, quota) }
  }),
)

function goBucket(sid: string, bucket: string) {
  void router.push({ ...links.value.storage('object', sid), query: { bucket } })
}
</script>

<template>
  <PanelHeader :title="t('storage.title')" :sub="t('storage.navSub')" />
  <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-14 scroll-thin">
    <div class="pt-2">
      <NavItem
        :label="t('storage.overview.nav')"
        icon="layout-grid"
        :active="!kind"
        @click="router.push(links.storage())"
      />
    </div>

    <SectionLabel :label="t('storage.object.section')" :count="storages.length" class="-mx-2 mt-2">
      <PButton
        square
        size="xs"
        variant="ghost"
        :icon="Plus"
        :label="t('storage.connect.title')"
        :title="t('storage.connect.title')"
        @click="emit('connect')"
      />
    </SectionLabel>
    <div class="flex flex-col gap-0.5">
      <template v-for="st in storages" :key="st.id">
        <NavItem
          :label="st.name"
          :icon="PURPOSES[st.purpose ?? 'files'].icon"
          :sub="t('storage.object.bucketCount', { n: st.buckets.length }, st.buckets.length)"
          :active="kind === 'object' && itemId === st.id && !bucket"
          :status="missingCredentials(st).length ? 'warn' : 'ok'"
          :title="
            missingCredentials(st).length ? t('storage.object.missingKeys') : t('storage.object.allKeys')
          "
          @click="router.push(links.storage('object', st.id))"
        />
        <NavItem
          v-for="b in st.buckets"
          :key="b.name"
          :label="b.name"
          icon="folder"
          :depth="1"
          :active="kind === 'object' && itemId === st.id && bucket === b.name"
          @click="goBucket(st.id, b.name)"
        />
      </template>
      <p v-if="!storages.length" class="px-2.5 py-2 text-sm text-faint">{{ t('storage.object.none') }}</p>
    </div>

    <SectionLabel :label="t('storage.local.section')" :count="folders.length" class="-mx-2 mt-3">
      <PButton
        square
        size="xs"
        variant="ghost"
        :icon="Plus"
        :label="t('storage.local.addFolder')"
        :title="t('storage.local.addFolder')"
        @click="emit('addFolder')"
      />
    </SectionLabel>
    <div class="flex flex-col gap-0.5">
      <NavItem
        :label="t('storage.local.title')"
        icon="server"
        :sub="definition.storage.local.root"
        :active="kind === 'local' && !itemId"
        @click="router.push(links.storage('local'))"
      />
      <NavItem
        v-for="x in folders"
        :key="x.f.id"
        :label="`${x.f.path}/`"
        icon="folder"
        :depth="1"
        :sub="
          x.used !== undefined
            ? t('storage.local.usedOf', { used: fmtBytes(x.used), quota: x.f.quota })
            : x.f.quota
        "
        :status="x.warn ? 'warn' : null"
        :active="kind === 'local' && itemId === x.f.id"
        @click="router.push(links.storage('local', x.f.id))"
      />
    </div>

    <div class="mt-4 px-1">
      <PButton variant="outline" size="sm" :icon="Plus" class="w-full" @click="emit('connect')">{{
        t('storage.connect.title')
      }}</PButton>
    </div>
  </div>
</template>
