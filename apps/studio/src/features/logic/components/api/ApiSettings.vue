<script setup lang="ts">
/** API settings: protocol, endpoint, access, request and response schemas (requirements §3.3 APIs). */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Globe, Lock } from 'lucide-vue-next'
import {
  formatFields,
  pathParams,
  VALUE_TYPES,
  type Api,
  type ApiAccess,
  type TypedField,
} from '@platon/definition'
import { cn, PField, PIcon, PInput, PSegmented, PSelect, PTabs } from '@platon/ui'
import { useDefinitionStore } from '@/stores/definition'
import {
  accessLabel,
  apiLabel,
  CODE_DESC,
  convertProtocol,
  payloadExample,
  PROTO_CODES,
  PROTO_CT,
  PROTOCOLS,
  REST_CTS,
  syncPathParams,
  type Protocol,
} from '../../lib/apis'
import FieldSchemaEditor from '../FieldSchemaEditor.vue'
import Section from '../Section.vue'
import DeleteItem from '../DeleteItem.vue'

const props = defineProps<{ api: Api }>()
const emit = defineEmits<{ edit: [fn: (a: Api) => Api]; remove: [] }>()
const { t } = useI18n()
const def = useDefinitionStore()

const METHODS: Api['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const open = ref({ proto: false, endpoint: true, access: true, request: true, response: true })
const reqTab = ref<'path' | 'headers' | 'query' | 'body'>('body')
const respCode = ref<string>('')
const types = VALUE_TYPES

const isRest = computed(() => props.api.protocol === 'rest')
const label = computed(() => apiLabel(props.api))
const noBody = computed(() => isRest.value && (props.api.method === 'GET' || props.api.method === 'DELETE'))

function update(fn: (a: Api) => Api) {
  emit('edit', fn)
}
function set<K extends keyof Api>(k: K, v: Api[K]) {
  update((a) => syncPathParams({ ...a, [k]: v }))
}
function setProtocol(p: Protocol) {
  update((a) => convertProtocol(a, p))
  respCode.value = ''
}

// ── access ──
const roles = computed(() => (def.definition?.roles ?? []).map((r) => r.name))
const perms = computed(() =>
  [...new Set((def.definition?.roles ?? []).flatMap((r) => r.permissions).filter((p) => p !== '*'))].sort(),
)
function setAccess(patch: Partial<ApiAccess>) {
  update((a) => ({ ...a, access: { ...a.access, ...patch } }))
}
function toggleIn(list: 'roles' | 'perms', v: string) {
  const cur = props.api.access[list] ?? []
  setAccess({ [list]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] })
}
const ACCESS = computed(() => [
  {
    value: 'public' as const,
    label: t('logic.api.access.public'),
    desc: t('logic.api.access.publicDesc'),
    icon: Globe,
  },
  {
    value: 'basic' as const,
    label: t('logic.api.access.basic'),
    desc: t('logic.api.access.basicDesc'),
    icon: Lock,
  },
  {
    value: 'token' as const,
    label: t('logic.api.access.token'),
    desc: t('logic.api.access.tokenDesc'),
    icon: Lock,
  },
])

// ── request ──
const reqTabs = computed(() =>
  (isRest.value ? (['path', 'headers', 'query', 'body'] as const) : (['headers', 'body'] as const)).map(
    (k) => ({ value: k, label: t(`logic.api.req.${k}`), count: props.api.request[k].length || undefined }),
  ),
)
const activeReqTab = computed(() =>
  reqTabs.value.some((x) => x.value === reqTab.value) ? reqTab.value : 'body',
)
function setReq(k: 'path' | 'headers' | 'query' | 'body', fields: TypedField[]) {
  update((a) => ({ ...a, request: { ...a.request, [k]: fields } }))
}
const reqExample = computed(() => {
  const r = props.api.request
  if (isRest.value && noBody.value) {
    const qs = r.query.map((f) => `${f.name}=…`).join('&')
    return `${props.api.method} ${props.api.path}${qs ? `?${qs}` : ''}`
  }
  return payloadExample(props.api.protocol, r.body, 'request', props.api)
})

// ── response ──
const codes = computed(() => {
  const own = Object.keys(props.api.responses)
  const std = PROTO_CODES[props.api.protocol]
  return [...std, ...own.filter((c) => !std.includes(c))]
})
const code = computed(() =>
  respCode.value && codes.value.includes(respCode.value) ? respCode.value : codes.value[0]!,
)
const resp = computed(
  () => props.api.responses[code.value] ?? { contentType: PROTO_CT[props.api.protocol], fields: [] },
)
function setResp(patch: Partial<Api['responses'][string]>) {
  update((a) => ({ ...a, responses: { ...a.responses, [code.value]: { ...resp.value, ...patch } } }))
}
const respExample = computed(() =>
  payloadExample(props.api.protocol, resp.value.fields, 'response', props.api, code.value),
)

const summaryReq = computed(() => {
  const r = props.api.request
  const all = [...r.path, ...r.query, ...r.body]
  return all.length ? formatFields(all) : t('logic.api.noInput')
})
</script>

<template>
  <div class="flex flex-col">
    <Section
      v-model:open="open.proto"
      :title="t('logic.api.protocol')"
      :summary="`${PROTOCOLS[api.protocol].label} · ${PROTOCOLS[api.protocol].desc}`"
    >
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="(p, k) in PROTOCOLS"
          :key="k"
          type="button"
          :class="
            cn(
              'flex items-start gap-2 rounded-lg border p-2.5 text-left',
              api.protocol === k ? 'border-primary bg-primary-tint' : 'border-line hover:bg-hover',
            )
          "
          @click="setProtocol(k)"
        >
          <PIcon
            :name="p.icon"
            :size="15"
            :class="api.protocol === k ? 'text-primary-strong' : 'text-muted'"
          />
          <span class="min-w-0">
            <span class="block text-sm font-bold">{{ p.label }}</span>
            <span class="block text-2xs text-muted">{{ p.desc }}</span>
          </span>
        </button>
      </div>
      <p class="text-xs text-faint">{{ t('logic.api.protocolHint') }}</p>
    </Section>

    <Section
      v-model:open="open.endpoint"
      :title="t('logic.api.endpoint')"
      :summary="`${label.badge} ${label.text}`"
    >
      <template v-if="api.protocol === 'rest'">
        <div class="flex gap-2">
          <PSelect
            class="w-[110px] shrink-0 font-mono"
            :model-value="api.method"
            :options="METHODS.map((m) => ({ value: m, label: m }))"
            @update:model-value="(m) => m && set('method', m)"
          />
          <PInput
            mono
            class="flex-1"
            :model-value="api.path"
            @update:model-value="set('path', String($event ?? ''))"
          />
        </div>
        <p class="-mt-1 text-xs text-faint">
          {{
            pathParams(api.path).length
              ? t('logic.api.pathParams', {
                  list: pathParams(api.path)
                    .map((p) => `:${p}`)
                    .join(', '),
                })
              : t('logic.api.pathHint')
          }}
        </p>
      </template>
      <template v-else-if="api.protocol === 'soap'">
        <PField :label="t('logic.api.service')"
          ><PInput
            mono
            :model-value="api.service ?? ''"
            @update:model-value="set('service', String($event ?? ''))"
        /></PField>
        <PField :label="t('logic.api.operation')"
          ><PInput
            mono
            :model-value="api.operation ?? ''"
            @update:model-value="set('operation', String($event ?? ''))"
        /></PField>
        <PField :label="t('logic.api.soapPath')"
          ><PInput mono :model-value="api.path" @update:model-value="set('path', String($event ?? ''))"
        /></PField>
      </template>
      <template v-else-if="api.protocol === 'grpc'">
        <PField :label="t('logic.api.grpcService')"
          ><PInput
            mono
            :model-value="api.service ?? ''"
            @update:model-value="
              update((a) => ({
                ...a,
                service: String($event ?? ''),
                path: `/${$event}/${a.operation ?? ''}`,
              }))
            "
        /></PField>
        <PField :label="t('logic.api.grpcMethod')"
          ><PInput
            mono
            :model-value="api.operation ?? ''"
            @update:model-value="
              update((a) => ({
                ...a,
                operation: String($event ?? ''),
                path: `/${a.service ?? ''}/${$event}`,
              }))
            "
        /></PField>
        <p class="-mt-1 font-mono text-xs text-faint">{{ api.path }}</p>
      </template>
      <template v-else>
        <PField :label="t('logic.api.rpcMethod')"
          ><PInput
            mono
            :model-value="api.operation ?? ''"
            @update:model-value="set('operation', String($event ?? ''))"
        /></PField>
        <PField :label="t('logic.api.rpcPath')"
          ><PInput mono :model-value="api.path" @update:model-value="set('path', String($event ?? ''))"
        /></PField>
      </template>
      <PField :label="t('logic.fnSettings.description')">
        <PInput
          :model-value="api.description ?? ''"
          :placeholder="t('logic.api.descriptionPh')"
          @update:model-value="set('description', String($event ?? ''))"
        />
      </PField>
    </Section>

    <Section v-model:open="open.access" :title="t('logic.api.accessTitle')" :summary="accessLabel(api)">
      <div class="grid grid-cols-3 gap-1.5">
        <button
          v-for="a in ACCESS"
          :key="a.value"
          type="button"
          :title="a.desc"
          :class="
            cn(
              'flex flex-col items-start gap-0.5 rounded-lg border p-2 text-left',
              api.access.type === a.value ? 'border-primary bg-primary-tint' : 'border-line hover:bg-hover',
            )
          "
          @click="setAccess({ type: a.value })"
        >
          <component
            :is="a.icon"
            :size="14"
            :class="api.access.type === a.value ? 'text-primary-strong' : 'text-muted'"
          />
          <span class="text-sm font-bold">{{ a.label }}</span>
          <span class="text-2xs leading-tight text-muted">{{ a.desc }}</span>
        </button>
      </div>
      <p
        v-if="api.access.type === 'public'"
        class="flex items-center gap-1.5 rounded-lg bg-warn-bg px-2.5 py-2 text-sm text-warn"
      >
        <Globe :size="13" />{{ t('logic.api.access.publicWarn') }}
      </p>
      <template v-else>
        <PSegmented
          block
          :model-value="api.access.who"
          :options="[
            { value: 'any', label: t('logic.api.access.anyone') },
            { value: 'roles', label: t('logic.api.access.selected') },
          ]"
          @update:model-value="setAccess({ who: $event })"
        />
        <template v-if="api.access.who === 'roles'">
          <div class="eyebrow">{{ t('logic.api.access.roles') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="r in roles"
              :key="r"
              type="button"
              :class="
                cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
                  api.access.roles?.includes(r)
                    ? 'border-primary-ring bg-primary-tint text-primary-strong'
                    : 'border-line text-muted hover:bg-hover',
                )
              "
              @click="toggleIn('roles', r)"
            >
              <Check v-if="api.access.roles?.includes(r)" :size="11" />{{ r }}
            </button>
          </div>
          <div class="eyebrow">{{ t('logic.api.access.perms') }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="p in perms"
              :key="p"
              type="button"
              :class="
                cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-2xs font-semibold',
                  api.access.perms?.includes(p)
                    ? 'border-primary-ring bg-primary-tint text-primary-strong'
                    : 'border-line text-muted hover:bg-hover',
                )
              "
              @click="toggleIn('perms', p)"
            >
              <Check v-if="api.access.perms?.includes(p)" :size="11" />{{ p }}
            </button>
          </div>
          <p class="text-xs text-faint">{{ t('logic.api.access.hint') }}</p>
        </template>
      </template>
    </Section>

    <Section v-model:open="open.request" :title="t('logic.api.request')" :summary="summaryReq">
      <PTabs v-model="reqTab" :items="reqTabs" variant="pill" />
      <p class="text-xs text-faint">{{ t(`logic.api.req.${activeReqTab}Hint`) }}</p>
      <PField v-if="activeReqTab === 'body' && isRest && !noBody" :label="t('logic.api.contentType')">
        <PSelect
          class="font-mono"
          :model-value="api.request.contentType"
          :options="REST_CTS.map((c) => ({ value: c, label: c }))"
          @update:model-value="
            update((a) => ({ ...a, request: { ...a.request, contentType: $event ?? a.request.contentType } }))
          "
        />
      </PField>
      <div v-else-if="activeReqTab === 'body' && !isRest" class="flex justify-between text-sm">
        <span class="text-muted">{{ t('logic.api.contentType') }}</span
        ><span class="font-mono">{{ PROTO_CT[api.protocol] }}</span>
      </div>
      <p v-if="activeReqTab === 'body' && noBody" class="rounded-lg bg-subtle px-2.5 py-2 text-sm text-muted">
        {{ t('logic.api.noBody') }}
      </p>
      <template v-else>
        <div
          v-if="activeReqTab === 'headers' && api.access.type !== 'public'"
          class="flex items-center justify-between rounded-lg bg-subtle px-2.5 py-1.5 text-sm"
        >
          <span class="font-mono">Authorization</span
          ><span class="text-xs text-faint">{{ t('logic.api.fromAccess') }}</span>
        </div>
        <FieldSchemaEditor
          :fields="api.request[activeReqTab]"
          :types="types"
          :locked="activeReqTab === 'path' ? pathParams(api.path) : []"
          :no-add="activeReqTab === 'path'"
          :empty-text="activeReqTab === 'path' ? t('logic.api.noPathParams') : t('logic.api.noneYet')"
          @update="setReq(activeReqTab, $event)"
        />
      </template>
      <div class="eyebrow">{{ t('logic.api.example') }}</div>
      <pre
        class="m-0 max-h-56 overflow-auto rounded-lg bg-code-bg p-3 font-mono text-xs leading-5 text-code-fg scroll-thin"
        >{{ reqExample }}</pre>
    </Section>

    <Section v-model:open="open.response" :title="t('logic.api.response')" :summary="codes.join(' · ')">
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="c in codes"
          :key="c"
          type="button"
          :class="
            cn(
              'rounded-md border px-2 py-0.5 font-mono text-xs font-bold',
              c === code
                ? 'border-primary bg-primary-tint text-primary-strong'
                : 'border-line hover:bg-hover',
              c !== code && (c === codes[0] ? 'text-ok' : 'text-danger'),
            )
          "
          @click="respCode = c"
        >
          {{ c }}
        </button>
      </div>
      <p class="text-sm text-muted">{{ CODE_DESC[code] ?? '' }}</p>
      <PField v-if="isRest" :label="t('logic.api.contentType')">
        <PSelect
          class="font-mono"
          :model-value="resp.contentType"
          :options="REST_CTS.map((c) => ({ value: c, label: c }))"
          @update:model-value="setResp({ contentType: $event ?? resp.contentType })"
        />
      </PField>
      <div v-else class="flex justify-between text-sm">
        <span class="text-muted">{{ t('logic.api.contentType') }}</span
        ><span class="font-mono">{{ PROTO_CT[api.protocol] }}</span>
      </div>
      <FieldSchemaEditor
        :fields="resp.fields"
        :types="types"
        :empty-text="t('logic.api.noResponseBody')"
        :add-label="t('logic.api.addField')"
        @update="setResp({ fields: $event })"
      />
      <div class="eyebrow">{{ t('logic.api.example') }}</div>
      <pre
        class="m-0 max-h-56 overflow-auto rounded-lg bg-code-bg p-3 font-mono text-xs leading-5 text-code-fg scroll-thin"
        >{{ respExample }}</pre>
    </Section>

    <DeleteItem
      :name="`${label.badge} ${label.text}`"
      :noun="t('logic.noun.apis')"
      @confirm="emit('remove')"
    />
  </div>
</template>
