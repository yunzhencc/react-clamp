import type { ComponentCase } from './components'
import { expect, test } from '@playwright/test'

const text
  = '中文与 Emoji 👨‍👩‍👧‍👦 hello world. A reasonably long text with words and punctuation. '.repeat(
    6,
  )
for (const scenario of [
  { kind: 'line' },
  { kind: 'line', maxLines: 2, location: 2 },
  { kind: 'line', maxLines: 2, location: 2, ellipsis: '...' },
  { kind: 'line', maxLines: 2, location: -1, ellipsis: '...' },
  { kind: 'line', maxLines: 2, location: NaN, ellipsis: '...' },
  { kind: 'line', maxHeight: -1, ellipsis: '...' },
  { kind: 'line', maxHeight: NaN, ellipsis: '...' },
  { kind: 'wrap', maxHeight: -1, affixes: true },
  { kind: 'line', maxLines: 0 },
  { kind: 'line', maxLines: 1.8 },
  { kind: 'line', maxHeight: '3em', ellipsis: '...' },
  { kind: 'line', maxLines: 2, location: 'middle' },
  {
    kind: 'line',
    maxLines: 2,
    boundary: 'word',
    affixes: true,
    ellipsis: '...',
  },
  { kind: 'inline', location: 'start', ellipsis: '...' },
  { kind: 'wrap' },
  { kind: 'wrap', maxLines: 2, affixes: true },
  { kind: 'wrap', maxHeight: '3em', affixes: true },
] satisfies ComponentCase[]) {
  test(`component constraints ${JSON.stringify(scenario)}`, async ({ page }) => {
    await page.goto('/tests/browser/components.html')
    await page.waitForFunction(() => !!window.mountComponent)
    await page.evaluate(value => window.mountComponent(value), {
      text,
      ...scenario,
    })
    const root = page.locator('#react [data-part="root"]')
    await expect(root).toBeVisible()
    const options: ComponentCase = scenario
    const lines = options.kind === 'inline'
      ? 1
      : options.maxLines && options.maxLines > 0 ? Math.floor(options.maxLines) : undefined
    const height = options.maxHeight === '3em' ? 48 : lines ? lines * 24 : undefined
    if (Number.isNaN(options.location)) {
      // Preserve the existing invalid-ratio output formerly checked by comparison.
      await expect(root.locator('[data-part="body"] [aria-hidden="true"]')).toHaveText(
        `${text.trim()}...${text.trim()}`,
      )
    }
    else if (height !== undefined) {
      await expect(root).toHaveAttribute('data-clamped', 'true')
      await expect.poll(() => root.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(height + 1)
    }
    else if (options.kind === 'wrap') {
      await expect(root.locator('[data-part="item"]')).toHaveCount(20)
    }
    else {
      await expect(root.locator('[data-part="body"]')).toHaveText(text)
    }
  })
}

test('data wrap mounts a bounded prefix for a large collapsed list', async ({
  page,
}) => {
  await page.goto('/tests/browser/components.html')
  await page.waitForFunction(() => !!window.mountComponent)
  await page.evaluate(() =>
    window.mountComponent({
      kind: 'wrap',
      maxLines: 1,
      affixes: true,
      count: 1000,
    }),
  )
  await expect
    .poll(() => page.locator('#react [data-part="item"]').count())
    .toBeLessThan(20)
})

test('predictive entry grows word-boundary output within its line limit on resize', async ({
  page,
}) => {
  await page.goto('/tests/browser/components.html')
  await page.waitForFunction(() => !!window.mountComponent)
  await page.evaluate(() =>
    window.mountComponent({
      predictive: true,
      text: 'The quick brown fox jumps over the lazy dog. '.repeat(30),
      maxLines: 2,
      boundary: 'word',
      affixes: true,
    }),
  )
  await expect(page.locator('#react [data-part="body"]')).toBeVisible()
  const shown = async (id: string) =>
    page
      .locator(`#${id} [data-part="body"]`)
      .first()
      .evaluate(
        el => (el.querySelector('[aria-hidden="true"]') ?? el).textContent,
      )
  const root = page.locator('#react [data-part="root"]')
  await expect(root).toHaveAttribute('data-clamped', 'true')
  const initial = await shown('react')
  await expect.poll(() => root.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(48)
  await page.locator('#react').evaluate((el) => {
    (el as HTMLElement).style.width = '320px'
  })
  await expect.poll(async () => (await shown('react'))!.length).toBeGreaterThan(initial!.length)
  await expect.poll(() => root.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(48)
})

test('warm predictive width updates use observer sizes without geometry reads', async ({
  page,
}) => {
  await page.goto('/tests/browser/components.html')
  await page.waitForFunction(() => !!window.mountComponent)
  await page.evaluate(() =>
    window.mountComponent({
      predictive: true,
      text: 'The quick brown fox jumps over the lazy dog. '.repeat(30),
      maxLines: 2,
      boundary: 'word',
    }),
  )
  await expect(page.locator('#react [data-part="root"]')).toBeVisible()
  await page.waitForTimeout(80)
  const reads = await page.evaluate(async () => {
    let count = 0
    const originalRect = Element.prototype.getBoundingClientRect
    const originalStyle = window.getComputedStyle
    Element.prototype.getBoundingClientRect = function () {
      if (this.closest('#react'))
        count++
      return originalRect.call(this)
    }
    window.getComputedStyle = function (el, pseudo) {
      if (el.closest('#react'))
        count++
      return originalStyle.call(this, el, pseudo)
    }
    try {
      for (const width of [280, 300, 320, 340, 360]) {
        document.getElementById('react')!.style.width = `${width}px`
        await new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      }
    }
    finally {
      Element.prototype.getBoundingClientRect = originalRect
      window.getComputedStyle = originalStyle
    }
    return count
  })
  expect(reads).toBe(0)
})

test('data wrap does not repeatedly materialize the hidden suffix on resize', async ({
  page,
}) => {
  await page.goto('/tests/browser/components.html')
  await page.waitForFunction(() => !!window.mountComponent)
  await page.evaluate(() =>
    window.mountComponent({
      kind: 'wrap',
      maxLines: 2,
      count: 1000,
      affixes: true,
    }),
  )
  await page.waitForTimeout(80)
  const reads = await page.evaluate(async () => {
    let reads = 0
    const original = Element.prototype.getBoundingClientRect
    Element.prototype.getBoundingClientRect = function () {
      if (this.closest('#react'))
        reads++
      return original.call(this)
    }
    try {
      for (const width of [250, 260, 270, 280, 290]) {
        document.getElementById('react')!.style.width = `${width}px`
        await new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      }
    }
    finally {
      Element.prototype.getBoundingClientRect = original
    }
    return reads
  })
  expect(reads).toBeLessThan(200)
})

for (const kind of ['line', 'rich'] as const) {
  test(`warm ${kind} resize avoids duplicate measurement passes`, async ({
    page,
  }) => {
    await page.goto('/tests/browser/components.html')
    await page.waitForFunction(() => !!window.mountComponent)
    await page.evaluate(
      kind =>
        window.mountComponent({
          kind,
          maxLines: 2,
          ellipsis: '...',
          text: 'The quick brown fox jumps over the lazy dog. '.repeat(100),
          ...(kind === 'rich'
            ? {
                html: '<strong>Formatted words</strong> with <em>inline markup</em>. '.repeat(
                  100,
                ),
              }
            : {}),
        }),
      kind,
    )
    await page.waitForTimeout(100)
    const reads = await page.evaluate(async () => {
      let rect = 0
      let style = 0
      const originalRect = Element.prototype.getBoundingClientRect
      const originalRects = Element.prototype.getClientRects
      const originalRange = Range.prototype.getClientRects
      const originalStyle = window.getComputedStyle
      const belongs = (node: Node) =>
        (node instanceof Element ? node : node.parentElement)?.closest(
          '#react',
        )
      Element.prototype.getBoundingClientRect = function () {
        if (belongs(this))
          rect++
        return originalRect.call(this)
      }
      Element.prototype.getClientRects = function () {
        if (belongs(this))
          rect++
        return originalRects.call(this)
      }
      Range.prototype.getClientRects = function () {
        if (belongs(this.commonAncestorContainer))
          rect++
        return originalRange.call(this)
      }
      window.getComputedStyle = function (el, pseudo) {
        if (belongs(el))
          style++
        return originalStyle.call(this, el, pseudo)
      }
      try {
        for (const width of [
          250,
          260,
          270,
          280,
          290,
          300,
          290,
          280,
          270,
          260,
        ]) {
          document.getElementById('react')!.style.width = `${width}px`
          await new Promise<void>(resolve =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          )
        }
      }
      finally {
        Element.prototype.getBoundingClientRect = originalRect
        Element.prototype.getClientRects = originalRects
        Range.prototype.getClientRects = originalRange
        window.getComputedStyle = originalStyle
      }
      return { rect, style }
    })
    expect(reads.rect).toBeLessThanOrEqual(90)
    expect(reads.style).toBeLessThanOrEqual(2200)
    await expect(page.locator('#react [data-part="root"]')).toHaveAttribute(
      'data-clamped',
      'true',
    )
  })
}

for (const sample of [
  {
    name: 'RTL Arabic',
    text: 'مرحبا بالعالم هذه فقرة طويلة لاختبار التفاف النص والحروف العربية '.repeat(
      10,
    ),
    css: 'font:18px/28px serif;direction:rtl',
    location: 'middle' as const,
  },
  {
    name: 'CJK spacing',
    text: '中文排版与组合字符é以及家庭👨‍👩‍👧‍👦 mixed words '.repeat(10),
    css: 'font:17px/27px sans-serif;letter-spacing:1.25px;word-spacing:2px',
  },
  {
    name: 'monospace words',
    text: 'verylongunbrokenfilename_with_combining_é_and_suffix.txt followed by other words '.repeat(
      8,
    ),
    css: 'font:16px/25px monospace',
    boundary: 'word' as const,
  },
]) {
  test(`layout constraints ${sample.name}`, async ({ page }) => {
    await page.goto('/tests/browser/components.html')
    await page.waitForFunction(() => !!window.mountComponent)
    await page.evaluate(
      ({ css, name, ...sample }) =>
        window.mountComponent({ ...sample, maxLines: 3, ellipsis: '...' }),
      sample,
    )
    await page
      .locator('#react')
      .evaluateAll(
        (els, css) =>
          els.forEach(
            el => ((el as HTMLElement).style.cssText = `width:240px;${css}`),
          ),
        sample.css,
      )
    for (const width of [240, 400, 180]) {
      await page
        .locator('#react')
        .evaluateAll(
          (els, width) =>
            els.forEach(
              el => ((el as HTMLElement).style.width = `${width}px`),
            ),
          width,
        )
      const root = page.locator('#react [data-part="root"]')
      await expect(root).toHaveAttribute('data-clamped', 'true')
      const lineHeight = Number.parseFloat(sample.css.match(/\/(\d+)px/u)![1]!)
      await expect.poll(() => root.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(lineHeight * 3 + 1)
    }
  })
}

test('percentage height expands when the containing block grows', async ({
  page,
}) => {
  await page.goto('/tests/browser/components.html')
  await page.waitForFunction(() => !!window.mountComponent)
  await page.evaluate(() =>
    window.mountComponent({
      text: 'Words and more words for height clipping. '.repeat(30),
      maxHeight: '50%',
      ellipsis: '...',
    }),
  )
  const shown = (id: string) =>
    page
      .locator(`#${id} [data-part="body"]`)
      .first()
      .evaluate(
        el =>
          (el.querySelector('[aria-hidden="true"]') ?? el).textContent ?? '',
      )
  let previousLength = 0
  let initialText: string | undefined
  for (const height of [96, 240, 96]) {
    await page
      .locator('#react')
      .evaluateAll(
        (els, height) =>
          els.forEach(
            el => ((el as HTMLElement).style.height = `${height}px`),
          ),
        height,
      )
    if (height === 240) {
      await expect
        .poll(async () => (await shown('react')).length)
        .toBeGreaterThan(previousLength)
    }
    if (height === 96 && initialText !== undefined)
      await expect.poll(() => shown('react')).toBe(initialText)
    await expect
      .poll(() =>
        page
          .locator('#react [data-part="root"]')
          .evaluate(el => el.getBoundingClientRect().height),
      )
      .toBe(height / 2)
    initialText ??= await shown('react')
    previousLength = (await shown('react')).length
  }
})
