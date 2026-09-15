import type { Page } from '@playwright/test'
import type { WrapCase } from './wrap'
import { expect, test } from '@playwright/test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { WrapClamp } from '../../dist/index.js'

const items = (page: Page) => page.locator('[data-part="item"]:visible')
const root = (page: Page) => page.locator('[data-part="root"]')
async function mount(page: Page, value: WrapCase = {}) {
  await page.goto('/tests/browser/wrap.html')
  await page.waitForFunction(() => !!window.mountWrap)
  await page.evaluate(value => window.mountWrap(value), value)
}

test('wrap keeps whole items and reserves the last row for the exact hidden count', async ({
  page,
}) => {
  await mount(page)
  await expect(items(page)).toHaveCount(5)
  await expect(page.locator('[data-part="after"]')).toHaveText('+3')
  const box = (await root(page).boundingBox())!
  const more = (await page.locator('[data-part="after"]').boundingBox())!
  const first = (await items(page).first().boundingBox())!
  const last = (await items(page).last().boundingBox())!
  // Native button heights differ across platforms; the limit is two flex rows.
  const height = first.height + 8 + Math.max(last.height, more.height)
  expect(box.height).toBeLessThanOrEqual(height + 0.5)
  expect(more.y).toBeCloseTo(last.y, 1)
  expect(more.y + more.height).toBeLessThanOrEqual(box.y + height + 0.5)
  await page.getByRole('button', { name: 'Item 0: 0', exact: true }).click()
  await page.getByRole('button', { name: 'Show 3 more items' }).click()
  await expect(items(page)).toHaveCount(8)
  await expect(root(page)).toHaveAttribute('data-clamped', 'false')
  await page.getByRole('button', { name: 'Collapse items' }).click()
  await expect(items(page)).toHaveCount(5)
  await expect(
    page.getByRole('button', { name: 'Item 0: 1', exact: true }),
  ).toBeVisible()
})

test('wrap recovers on resize, changes items and handles an empty list', async ({
  page,
}) => {
  await mount(page)
  await expect(items(page)).toHaveCount(5)
  await page.locator('#container').evaluate((el) => {
    el.style.width = '800px'
  })
  await expect(items(page)).toHaveCount(8)
  await expect(page.locator('[data-part="after"]')).toBeHidden()
  await page.locator('#container').evaluate((el) => {
    el.style.width = '100px'
  })
  await expect(items(page)).toHaveCount(1)
  await page.evaluate(() => window.mountWrap({ count: 2, width: 240 }))
  await expect(items(page)).toHaveCount(2)
  await page.evaluate(() => window.mountWrap({ count: 0 }))
  await expect(items(page)).toHaveCount(0)
  await expect(root(page)).toHaveAttribute('data-clamped', 'false')
})

test('wrap fits a custom count-dependent control, height limits and controlled expansion', async ({
  page,
}) => {
  await mount(page, {
    count: 15,
    custom: true,
    maxHeight: 24,
    controlled: true,
  })
  await expect(items(page)).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'More 13' })).toBeVisible()
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(24.5)
  await page.getByRole('button', { name: 'More 13' }).click()
  await expect(items(page)).toHaveCount(15)
  await page.getByRole('button', { name: 'Less' }).click()
  await expect(items(page)).toHaveCount(2)
})

test('wrap preserves hidden child state and settles in StrictMode with large lists', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, { count: 200, defaultExpanded: true })
  await page.getByRole('button', { name: 'Item 199: 0', exact: true }).click()
  await page.evaluate(() => window.wrapHandle!.collapse())
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  await page.evaluate(() => window.wrapHandle!.expand())
  await expect(
    page.getByRole('button', { name: 'Item 199: 1', exact: true }),
  ).toBeVisible()
  await page.evaluate(() => window.wrapHandle!.collapse())
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  const count = await page.evaluate(() => window.wrapEvents.length)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.wrapEvents.length)).toBe(count)
  expect(errors).toEqual([])
})

test('wrap measures after an initially hidden ancestor becomes visible', async ({
  page,
}) => {
  await mount(page, { hidden: true })
  await page.locator('#container').evaluate((el) => {
    el.style.display = 'block'
  })
  await expect(items(page)).toHaveCount(5)
})

test('wrap observes child-owned size changes, including currently hidden items', async ({
  page,
}) => {
  await mount(page)
  await expect(items(page)).toHaveCount(5)
  await page.locator('[data-part="item"] button').evaluateAll((buttons) => {
    for (const button of buttons) (button as HTMLElement).style.width = '32px'
  })
  await expect(items(page)).toHaveCount(8)
  await expect(root(page)).toHaveAttribute('data-clamped', 'false')
  await page.locator('[data-part="item"] button').evaluateAll((buttons) => {
    for (const button of buttons) (button as HTMLElement).style.width = '100px'
  })
  await expect(items(page)).toHaveCount(3)
})

test('wrap hydrates complete server items without mismatches', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  const markup = renderToString(
    createElement(
      WrapClamp,
      { maxLines: 2, gap: 8 },
      Array.from({ length: 8 }, (_, i) =>
        createElement(
          'button',
          { key: i, style: { width: 64, height: 24, padding: 0 } },
          'Item ',
          i,
        )),
    ),
  )
  await page.addInitScript(() => {
    window.hydrationKind = 'wrap'
  })
  await page.route('**/wrap-hydrate', route =>
    route.fulfill({
      contentType: 'text/html',
      body:
        `<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root" style="width:240px">${
          markup
        }</div><script type="module" src="/tests/browser/hydration.tsx"></script></body></html>`,
    }))
  await page.goto('/wrap-hydrate')
  await expect(items(page)).toHaveCount(5)
  expect(await page.evaluate(() => window.hydrationErrors)).toEqual([])
  expect(errors).toEqual([])
})

test('wrap supports no control and hides an item that cannot fit whole', async ({
  page,
}) => {
  await mount(page, { noMore: true })
  await expect(items(page)).toHaveCount(6)
  await expect(page.locator('[data-part="after"]')).toBeHidden()
  await page.evaluate(() => window.mountWrap({ itemWidth: 300 }))
  await expect(items(page)).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Show 8 more items' }),
  ).toBeVisible()
})

test('wrap respects a height smaller than the control itself', async ({
  page,
}) => {
  await mount(page, { maxHeight: 1 })
  await expect(items(page)).toHaveCount(0)
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(1)
})
