import type { Page } from '@playwright/test'
import type { Case } from './fixture'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { LineClamp } from '../../dist/index.js'

const long
  = '中文与 Emoji 👨‍👩‍👧‍👦 文本需要根据实际宽度截断。The quick brown fox jumps over the lazy dog. '.repeat(
    4,
  )
async function mount(page: Page, value: Case) {
  await page.goto('/tests/browser/index.html')
  await page.waitForFunction(() => !!window.mountCase)
  await page.evaluate(value => window.mountCase(value), value)
  await expect(page.locator('[data-part="root"]')).toBeVisible()
}
// LineClamp now keeps its accessible source beside a stable visible-text span.
// InlineClamp still owns text directly on body; assert the visible node in both.
function body(page: Page) {
  return page.locator(
    '[data-part="body"] > span:not([data-part="source"]), [data-part="body"]:not(:has(> span))',
  )
}
const root = (page: Page) => page.locator('[data-part="root"]')

test('fixed extensions stay adjacent without overlapping the body', async ({
  page,
}) => {
  await mount(page, {
    text: 'summer-campaign-panorama-final',
    kind: 'inline',
    suffix: '.jpeg',
    location: 'middle',
    width: 220,
  })
  const gap = () =>
    page.evaluate(() => {
      const body = document.querySelector('[data-part="body"]')!
      const suffix = document.querySelector('[data-part="after"], [data-part="end"]')!
      const range = document.createRange()
      range.selectNodeContents(body)
      return (
        suffix.getBoundingClientRect().left
        - range.getBoundingClientRect().right
      )
    })
  await expect.poll(gap).toBeGreaterThanOrEqual(-0.5)
  await page.locator('#container').evaluate((el) => {
    el.style.width = '900px'
  })
  await expect(body(page)).toHaveText('summer-campaign-panorama-final')
  expect(await gap()).toBeLessThan(0.5)
})

test('CSS path limits visible lines and reports truncation', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 2 })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(48.5)
  await expect(body(page)).toHaveText(long)
})

test('measured suffix fits on the last line and expansion works', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 2, control: true })
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible()
  await expect(body(page)).toContainText('…')
  const box = (await root(page).boundingBox())!
  const button = (await page.getByRole('button').boundingBox())!
  expect(button.y + button.height).toBeLessThanOrEqual(box.y + 48.5)
  await page.getByRole('button').click()
  await expect(body(page)).toHaveText(long)
  await expect(page.getByRole('button', { name: 'Less' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await page.getByRole('button').click()
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
})

test('controlled expansion follows its parent', async ({ page }) => {
  await mount(page, {
    text: long,
    maxLines: 2,
    control: true,
    controlled: true,
  })
  await page.getByRole('button', { name: 'More' }).click()
  await expect(body(page)).toHaveText(long)
  await page.getByRole('button', { name: 'Less' }).click()
  await expect(body(page)).not.toHaveText(long)
})

test('expanding a one-line clamp restores wrapping instead of clipping full text', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 1, control: true })
  await page.getByRole('button', { name: 'More' }).click()
  await expect(body(page)).toHaveText(long)
  expect((await root(page).boundingBox())!.height).toBeGreaterThan(24)
  await page.getByRole('button', { name: 'Less' }).click()
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(24.5)
})

test('middle truncation retains fixed affixes and both body ends', async ({
  page,
}) => {
  await mount(page, {
    text: 'summer-campaign-panorama-final',
    kind: 'inline',
    suffix: '.jpeg',
    prefix: '/',
    location: 'middle',
  })
  await expect(body(page)).toHaveText(/^s[^\n\r\u2026\u2028\u2029]*\u2026.*l$/)
  await expect(page.locator('[data-part="after"], [data-part="end"]')).toHaveText('.jpeg')
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(24.5)
  const suffix = (await page.locator('[data-part="after"], [data-part="end"]').boundingBox())!
  const box = (await root(page).boundingBox())!
  expect(suffix.x + suffix.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
})

test('recomputes on external resize and restores full text', async ({
  page,
}) => {
  await mount(page, {
    text: 'A reasonably short sentence.',
    maxLines: 1,
    ellipsis: '...',
    width: 120,
  })
  await expect(body(page)).not.toHaveText('A reasonably short sentence.')
  await page.locator('#container').evaluate((el) => {
    el.style.width = '900px'
  })
  await expect(body(page)).toHaveText('A reasonably short sentence.')
  await expect(root(page)).toHaveAttribute('data-clamped', 'false')
  await page.locator('#container').evaluate((el) => {
    el.style.width = '90.5px'
  })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
})

test('updates source, limits and tag without stale measured content', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 2, ellipsis: '...' })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  await page.evaluate(() =>
    window.mountCase({ text: 'New', maxLines: 1, as: 'p' }),
  )
  await expect(page.locator('p[data-part="root"]')).toHaveText('New')
  await expect(root(page)).toHaveAttribute('data-clamped', 'false')
  await page.evaluate(() => window.mountCase({ text: '', maxLines: 1 }))
  await expect(root(page)).toHaveText('')
})

test('height limits and start ellipsis use actual browser layout', async ({
  page,
}) => {
  await mount(page, {
    text: long,
    maxHeight: 48,
    location: 'start',
    ellipsis: '...',
  })
  await expect(body(page)).toHaveText(/^\.\.\./)
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(48.5)
})

test('hidden containers recover and inherited font changes invalidate fitting', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 2, control: true })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  await page.locator('#container').evaluate((el) => {
    el.style.display = 'none'
    el.style.width = '130px'
  })
  await page.locator('#container').evaluate((el) => {
    el.style.display = ''
    el.style.fontSize = '24px'
    el.style.lineHeight = '32px'
  })
  await expect(root(page)).toBeVisible()
  await expect
    .poll(async () => (await root(page).boundingBox())!.height)
    .toBeLessThanOrEqual(64.5)
  const button = page.getByRole('button')
  await expect(button).toBeVisible()
  const box = (await root(page).boundingBox())!
  const buttonBox = (await button.boundingBox())!
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(box.y + 64.5)
})

test('keeps graphemes intact and exposes the complete accessible source once', async ({
  page,
}) => {
  const text = '👨‍👩‍👧‍👦e\u0301'.repeat(30)
  await mount(page, { text, maxLines: 1, ellipsis: '...', width: 160 })
  await expect(body(page)).toHaveAttribute('aria-hidden', 'true')
  await expect(page.locator('[data-part="source"]')).toHaveText(text)
  const shown = (await body(page).textContent())!.replace(/\.\.\.$/, '')
  const parts = [
    ...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      shown,
    ),
  ]
  expect(
    parts.every(x => x.segment === '👨‍👩‍👧‍👦' || x.segment === 'e\u0301'),
  ).toBe(true)
})

test('Strict Mode settles without repeated notifications or page errors', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mount(page, { text: long, maxLines: 2, control: true })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  const count = await page.evaluate(() => window.clampEvents.length)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.clampEvents.length)).toBe(count)
  expect(errors).toEqual([])
})

test('reports truncation even when source and ellipsis are identical', async ({
  page,
}) => {
  await mount(page, { text: '…', maxLines: 1, location: 'start', width: 1 })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
})

test('hydrates real server markup without mismatches and accepts later updates', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      errors.push(message.text())
  })
  const markup = renderToString(
    createElement(LineClamp, { text: long, maxLines: 2, ellipsis: '...' }),
  )
  await page.addInitScript((text) => {
    window.hydrationText = text
  }, long)
  await page.route('**/hydrate-test', route =>
    route.fulfill({
      contentType: 'text/html',
      body:
        `<!doctype html><html><head><meta charset="UTF-8"></head><body><div id="root" style="width:220px;font:16px/24px monospace">${
          markup
        }</div><script type="module" src="/tests/browser/hydration.tsx"></script></body></html>`,
    }))
  await page.goto('/hydrate-test')
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  expect(await page.evaluate(() => window.hydrationErrors)).toEqual([])
  await page.evaluate(() => window.updateHydrated())
  await expect(body(page)).toHaveText('Updated after hydration')
  expect(errors).toEqual([])
})

test('reclamps when after content grows without replacing the source text', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 2, control: true })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  const old = await body(page).textContent()
  await page.evaluate(
    text =>
      window.mountCase({
        text,
        maxLines: 2,
        control: true,
        largeControl: true,
      }),
    long,
  )
  await expect
    .poll(async () => (await body(page).textContent())!.length)
    .toBeLessThan(old!.length)
  expect((await root(page).boundingBox())!.height).toBeLessThanOrEqual(48.5)
})

test('default expansion and imperative controls retain the current root', async ({
  page,
}) => {
  await mount(page, { text: long, maxLines: 3, defaultExpanded: true, control: true })
  await expect(root(page)).toHaveAttribute('data-expanded', 'true')
  await page.evaluate(() => window.clampHandle!.collapse())
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  expect(
    await page.evaluate(
      () =>
        window.clampHandle!.element
        === document.querySelector('[data-part="root"]'),
    ),
  ).toBe(true)
  await page.evaluate(() => window.clampHandle!.expand())
  await expect(body(page)).toHaveText(long)
})

test('recomputes after a delayed font load with unchanged container dimensions', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/font-delay.ttf', async (route) => {
    await gate
    await route.fulfill({
      path: fileURLToPath(new URL('./fixtures/narrow.ttf', import.meta.url)),
      contentType: 'font/ttf',
    })
  })
  const text = 'i '.repeat(30).trim()
  await mount(page, { text, maxLines: 2, ellipsis: '...', width: 200 })
  await expect(root(page)).toHaveAttribute('data-clamped', 'true')
  await page.evaluate(() => {
    const style = document.createElement('style')
    style.textContent
      = '@font-face{font-family:ClampTest;src:url(/font-delay.ttf)}'
    document.head.append(style)
    document.getElementById('container')!.style.fontFamily
      = 'ClampTest, monospace'
  })
  release()
  await expect(body(page)).toHaveText(text)
  await expect(root(page)).toHaveAttribute('data-clamped', 'false')
})
