import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import BlockResizeHandle from '../BlockResizeHandle.vue'

const i18n = createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false })
// A 6-column block in a 1200px row (16px gaps).
const rect = { x: 0, y: 0, width: 592, height: 80 }
const make = (span = 6, max = 11, zoom = 1) =>
  mount(BlockResizeHandle, { props: { rect, span, max, zoom }, global: { plugins: [i18n] } })

describe('BlockResizeHandle', () => {
  it('resizes by one column with the arrow keys, within the row', async () => {
    const w = make()
    await w.get('[role=slider]').trigger('keydown', { key: 'ArrowRight' })
    await w.get('[role=slider]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('resize')).toEqual([[7], [5]])
    const full = make(11, 11)
    await full.get('[role=slider]').trigger('keydown', { key: 'ArrowRight' })
    expect(full.emitted('resize')).toBeUndefined()
  })

  it('snaps a drag to whole columns and applies it once on release', async () => {
    const w = make(6, 11, 0.5)
    const h = w.get('[role=slider]')
    const el = h.element as HTMLElement
    el.setPointerCapture = () => {}
    await h.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    // 30 screen px at 50% zoom = 60 iframe px: one column more.
    el.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 130 }))
    await w.vm.$nextTick()
    expect(w.get('[role=slider]').attributes('aria-valuenow')).toBe('7')
    expect(w.emitted('resize')).toBeUndefined()
    el.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 1000 }))
    el.dispatchEvent(new Event('pointerup'))
    expect(w.emitted('resize')).toEqual([[11]])
  })

  it('throws the preview away when the gesture is cancelled', async () => {
    const w = make()
    const h = w.get('[role=slider]')
    const el = h.element as HTMLElement
    el.setPointerCapture = () => {}
    await h.trigger('pointerdown', { clientX: 100, pointerId: 1 })
    el.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 300 }))
    el.dispatchEvent(new Event('pointercancel'))
    await w.vm.$nextTick()
    expect(w.emitted('resize')).toBeUndefined()
    expect(w.get('[role=slider]').attributes('aria-valuenow')).toBe('6')
  })
})
