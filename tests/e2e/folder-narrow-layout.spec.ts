import { expect, test } from '@playwright/test'
import { installTauriInvokeMock } from './helpers/tauriMock'

test.beforeEach(async ({ page }) => {
  await installTauriInvokeMock(page)
})

test('folder compare path criteria and actions do not overlap at 950px', async ({ page }) => {
  await page.setViewportSize({ width: 950, height: 700 })
  await page.goto('/compare/folder')
  await page.getByTestId('folder-left-root').fill('tests/fixtures/folder/left')
  await page.getByTestId('folder-right-root').fill('tests/fixtures/folder/right')
  await page.getByTestId('run-folder-compare').click()
  await page.waitForTimeout(500)

  const metrics = await page.evaluate(() => {
    const box = (selector: string): DOMRect | null => {
      const el = document.querySelector(selector)

      return el ? el.getBoundingClientRect() : null
    }
    const overlaps = (a: DOMRect | null, b: DOMRect | null): number => {
      if (!a || !b) {
        return 0
      }

      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

      return x * y
    }

    const left = box('[data-testid="folder-left-root"]')
    const right = box('[data-testid="folder-right-root"]')
    const criteria = box('[data-testid="folder-criteria"]')
    const hint = box('[data-testid="folder-path-hint"]')
    const pair = document.querySelector('.folder-toolbar .path-pair')
    const pairCols = pair ? getComputedStyle(pair).gridTemplateColumns : ''

    return {
      pairCols,
      leftRight: overlaps(left, right),
      leftCriteria: overlaps(left, criteria),
      rightCriteria: overlaps(right, criteria),
      hintLeft: overlaps(hint, left),
      hintRight: overlaps(hint, right),
      pathPairHeight: pair ? pair.getBoundingClientRect().height : 0,
    }
  })

  expect(metrics.pairCols.split(' ').length).toBe(1)
  expect(metrics.pathPairHeight).toBeGreaterThan(40)
  expect(metrics.leftRight).toBe(0)
  expect(metrics.leftCriteria).toBe(0)
  expect(metrics.rightCriteria).toBe(0)
  expect(metrics.hintLeft).toBe(0)
  expect(metrics.hintRight).toBe(0)
})

test('home Session menu panel is hit-testable after click', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.goto('/')
  await page.getByTestId('menu-session').click()
  const panel = page.getByTestId('menu-panel')

  await expect(panel).toBeVisible()

  const hit = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="menu-panel"] button')

    if (!button) {
      return false
    }
    const rect = button.getBoundingClientRect()
    const el = document.elementFromPoint(rect.left + 8, rect.top + 8)

    return Boolean(el?.closest('[data-testid="menu-panel"]'))
  })

  expect(hit).toBe(true)
})
