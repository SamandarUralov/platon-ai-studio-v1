<script setup lang="ts">
/** Route `components/:componentId?` — list of custom components, or one component's screen. */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { projectLinks, useProjectId } from '@/composables/useProject'
import ComponentEditor from './ComponentEditor.vue'
import ComponentList from './ComponentList.vue'
import NewComponentDialog from './NewComponentDialog.vue'
import { fullId, shortId } from './sfc'

const route = useRoute()
const router = useRouter()
const projectId = useProjectId()
const componentId = computed(() =>
  route.params.componentId ? fullId(String(route.params.componentId)) : null,
)

const dialogOpen = ref(false)
const dialogMethod = ref<'ai' | 'code'>('code')

function create(method: 'ai' | 'code') {
  dialogMethod.value = method
  dialogOpen.value = true
}
function open(id: string) {
  void router.push(projectLinks(projectId.value).components(shortId(id)))
}
</script>

<template>
  <ComponentEditor
    v-if="componentId"
    :key="componentId"
    :project-id="projectId"
    :component-id="componentId"
    @create="create"
  />
  <ComponentList v-else @open="open" @create="create" />
  <NewComponentDialog
    v-model:open="dialogOpen"
    :project-id="projectId"
    :initial-method="dialogMethod"
    @created="open"
  />
</template>
