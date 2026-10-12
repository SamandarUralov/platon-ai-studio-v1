import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import type { Block, Page, PropField } from '@platon/definition'

const blockField = vi.fn()
vi.mock('../../composables/useInterfaceEdits', () => ({ useInterfaceEdits: () => ({ blockField }) }))

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })
const block: Block = { id: 'g', type: 'grid', ref: 'grid', row: 0, props: { columns: 3 } }
const page = { id: 'p', name: 'P', route: '/p', blocks: [block] } as unknown as Page
const fields: PropField[] = [{ key: 'columns', label: 'Columns', input: 'number', min: 1, max: 6, def: 2 }]

describe('SchemaFields', () => {
  it('commits a number field (its input hands back numbers, not strings)', async () => {
    const SchemaFields = (await import('../inspector/SchemaFields.vue')).default
    const w = mount(SchemaFields, { props: { page, block, fields }, global: { plugins: [i18n] } })
    const input = w.get('input')
    await input.setValue('4')
    await input.trigger('change')
    expect(blockField).toHaveBeenCalledWith(page, block, ['props', 'columns'], 4, expect.any(String))
    await input.setValue('9')
    await input.trigger('change')
    expect(blockField).toHaveBeenLastCalledWith(page, block, ['props', 'columns'], 6, expect.any(String))
  })
})
