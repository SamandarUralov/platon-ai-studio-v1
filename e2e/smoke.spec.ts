import { expect, test } from '@playwright/test'

test('projects home lists the demo apps and opens one', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /next app do/ })).toBeVisible()
  await expect(page.getByText('FieldOps Service Desk')).toBeVisible()
  await page.getByRole('button', { name: 'Open FieldOps Service Desk' }).click()
  await expect(page).toHaveURL(/\/p\/fieldops\/interface/)
  await expect(page.getByRole('radiogroup', { name: 'Studio layers' })).toBeVisible()
})

test('layer tabs switch routes', async ({ page }) => {
  await page.goto('/p/fieldops/interface')
  for (const layer of ['Logic', 'Data', 'Storage', 'Preview']) {
    await page.getByRole('radio', { name: layer }).click()
    await expect(page).toHaveURL(new RegExp(`/p/fieldops/${layer.toLowerCase()}`))
  }
})

test('quick switcher opens with the keyboard', async ({ page }) => {
  await page.goto('/p/fieldops/interface')
  await expect(page.getByRole('radiogroup', { name: 'Studio layers' })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByPlaceholder(/Jump to/)).toBeFocused()
  await page.keyboard.type('calcSla')
  await expect(page.getByRole('button', { name: /calcSlaDue/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/logic\/functions\/calc_sla_due/)
})
