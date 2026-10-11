import { expect, test } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR

test('containers take blocks into their cells and kit elements render', async ({ page }) => {
  await page.goto('/p/fieldops/interface')
  const canvas = page.locator('[data-canvas-block]').first()
  await expect(canvas).toBeVisible()

  // Grid goes below the page; with the grid selected, the next element lands in its first cell.
  await page.getByPlaceholder('Search elements').fill('grid')
  await page.getByRole('button', { name: 'Grid', exact: true }).dblclick()
  const grid = page
    .locator('[data-canvas-block]')
    .filter({ has: page.getByText('Drop blocks here') })
    .last()
  await expect(grid).toBeVisible()

  await page.getByPlaceholder('Search elements').fill('kpi')
  await page.getByRole('button', { name: 'KPI card' }).dblclick()
  await expect(grid.locator('[data-canvas-block]')).toHaveCount(1)
  await expect(grid.getByText('vs last month')).toBeVisible()

  // Platon UI Kit button renders inside a scoped .pk wrapper.
  await page.getByPlaceholder('Search elements').fill('button')
  await page.getByRole('button', { name: 'Button', exact: true }).dblclick()
  await expect(grid.locator('.pk button')).toHaveCount(1)

  // The layers list shows the nesting.
  await expect(page.getByRole('button', { name: /KPI card|All / }).first()).toBeVisible()

  if (SHOTS) {
    await grid.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOTS}/canvas-grid.png` })
  }
})
