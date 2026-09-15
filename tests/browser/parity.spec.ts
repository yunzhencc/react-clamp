import { test, expect } from "@playwright/test";
import type { ParityCase } from "./parity";
const text =
  "中文与 Emoji 👨‍👩‍👧‍👦 hello world. A reasonably long text with words and punctuation. ".repeat(
    6,
  );
for (const scenario of [
  { kind: "line" },
  { kind: "line", maxLines: 2, location: 2 },
  { kind: "line", maxLines: 2, location: 2, ellipsis: "..." },
  { kind: "line", maxLines: 2, location: -1, ellipsis: "..." },
  { kind: "line", maxLines: 2, location: NaN, ellipsis: "..." },
  { kind: "line", maxHeight: -1, ellipsis: "..." },
  { kind: "line", maxHeight: NaN, ellipsis: "..." },
  { kind: "wrap", maxHeight: -1, affixes: true },
  { kind: "line", maxLines: 0 },
  { kind: "line", maxLines: 1.8 },
  { kind: "line", maxHeight: "3em", ellipsis: "..." },
  { kind: "line", maxLines: 2, location: "middle" },
  {
    kind: "line",
    maxLines: 2,
    boundary: "word",
    affixes: true,
    ellipsis: "...",
  },
  { kind: "inline", location: "start", ellipsis: "..." },
  { kind: "wrap" },
  { kind: "wrap", maxLines: 2, affixes: true },
  { kind: "wrap", maxHeight: "3em", affixes: true },
] satisfies ParityCase[]) {
  test(`upstream parity ${JSON.stringify(scenario)}`, async ({ page }) => {
    await page.goto("/tests/browser/parity.html");
    await page.waitForFunction(() => !!window.mountParity);
    await page.evaluate((value) => window.mountParity(value), {
      text,
      ...scenario,
    });
    await expect(page.locator('#vue [data-part="root"]')).toBeVisible();
    const value = async (id: string) =>
      page.locator(`#${id} [data-part="root"]`).evaluate((root) => ({
        text: (
          root.querySelector('[data-part="body"] [aria-hidden="true"]') ??
          root.querySelector('[data-part="body"]')
        )?.textContent,
        items: [...root.querySelectorAll('[data-part="item"]')]
          .filter((el) => el.getBoundingClientRect().width > 0)
          .map((el) => el.textContent),
        height: root.getBoundingClientRect().height,
      }));
    await expect
      .poll(
        async () => (await value("react")).text === (await value("vue")).text,
      )
      .toBe(true);
    await expect
      .poll(
        async () =>
          JSON.stringify((await value("react")).items) ===
          JSON.stringify((await value("vue")).items),
      )
      .toBe(true);
    expect(
      Math.abs((await value("react")).height - (await value("vue")).height),
    ).toBeLessThanOrEqual(1);
  });
}

test("data wrap mounts a bounded prefix for a large collapsed list", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  await page.evaluate(() =>
    window.mountParity({
      kind: "wrap",
      maxLines: 1,
      affixes: true,
      count: 1000,
    }),
  );
  await expect
    .poll(() => page.locator('#react [data-part="item"]').count())
    .toBeLessThan(20);
});

test("predictive entry matches upstream word-boundary output after resize", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  await page.evaluate(() =>
    window.mountParity({
      predictive: true,
      text: "The quick brown fox jumps over the lazy dog. ".repeat(30),
      maxLines: 2,
      boundary: "word",
      affixes: true,
    }),
  );
  await expect(page.locator('#react [data-part="body"]')).toBeVisible();
  const shown = async (id: string) =>
    page
      .locator(`#${id} [data-part="body"]`)
      .first()
      .evaluate(
        (el) => (el.querySelector('[aria-hidden="true"]') ?? el).textContent,
      );
  await expect
    .poll(async () => (await shown("react")) === (await shown("vue")))
    .toBe(true);
  await page.locator("#react,#vue").evaluateAll((elements) => {
    for (const el of elements) (el as HTMLElement).style.width = "320px";
  });
  await expect
    .poll(async () => (await shown("react")) === (await shown("vue")))
    .toBe(true);
});

test("warm predictive width updates use observer sizes without geometry reads", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  await page.evaluate(() =>
    window.mountParity({
      predictive: true,
      text: "The quick brown fox jumps over the lazy dog. ".repeat(30),
      maxLines: 2,
      boundary: "word",
    }),
  );
  await expect(page.locator('#react [data-part="root"]')).toBeVisible();
  await page.waitForTimeout(80);
  const reads = await page.evaluate(async () => {
    let count = 0;
    const originalRect = Element.prototype.getBoundingClientRect;
    const originalStyle = window.getComputedStyle;
    Element.prototype.getBoundingClientRect = function () {
      if (this.closest("#react")) count++;
      return originalRect.call(this);
    };
    window.getComputedStyle = function (el, pseudo) {
      if (el.closest("#react")) count++;
      return originalStyle.call(this, el, pseudo);
    };
    try {
      for (const width of [280, 300, 320, 340, 360]) {
        document.getElementById("react")!.style.width = width + "px";
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }
    } finally {
      Element.prototype.getBoundingClientRect = originalRect;
      window.getComputedStyle = originalStyle;
    }
    return count;
  });
  expect(reads).toBe(0);
});

test("data wrap does not repeatedly materialize the hidden suffix on resize", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  await page.evaluate(() =>
    window.mountParity({
      kind: "wrap",
      maxLines: 2,
      count: 1000,
      affixes: true,
    }),
  );
  await page.waitForTimeout(80);
  const reads = await page.evaluate(async () => {
    let reads = 0;
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (this.closest("#react")) reads++;
      return original.call(this);
    };
    try {
      for (const width of [250, 260, 270, 280, 290]) {
        document.getElementById("react")!.style.width = width + "px";
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }
    } finally {
      Element.prototype.getBoundingClientRect = original;
    }
    return reads;
  });
  expect(reads).toBeLessThan(200);
});

for (const kind of ["line", "rich"] as const) {
  test(`warm ${kind} resize avoids duplicate measurement passes`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/parity.html");
    await page.waitForFunction(() => !!window.mountParity);
    await page.evaluate(
      (kind) =>
        window.mountParity({
          kind,
          maxLines: 2,
          ellipsis: "...",
          text: "The quick brown fox jumps over the lazy dog. ".repeat(100),
          ...(kind === "rich"
            ? {
                html: "<strong>Formatted words</strong> with <em>inline markup</em>. ".repeat(
                  100,
                ),
              }
            : {}),
        }),
      kind,
    );
    await page.waitForTimeout(100);
    const reads = await page.evaluate(async () => {
      let rect = 0,
        style = 0;
      const originalRect = Element.prototype.getBoundingClientRect;
      const originalRects = Element.prototype.getClientRects;
      const originalRange = Range.prototype.getClientRects;
      const originalStyle = window.getComputedStyle;
      const belongs = (node: Node) =>
        (node instanceof Element ? node : node.parentElement)?.closest(
          "#react",
        );
      Element.prototype.getBoundingClientRect = function () {
        if (belongs(this)) rect++;
        return originalRect.call(this);
      };
      Element.prototype.getClientRects = function () {
        if (belongs(this)) rect++;
        return originalRects.call(this);
      };
      Range.prototype.getClientRects = function () {
        if (belongs(this.commonAncestorContainer)) rect++;
        return originalRange.call(this);
      };
      window.getComputedStyle = function (el, pseudo) {
        if (belongs(el)) style++;
        return originalStyle.call(this, el, pseudo);
      };
      try {
        for (const width of [
          250, 260, 270, 280, 290, 300, 290, 280, 270, 260,
        ]) {
          document.getElementById("react")!.style.width = width + "px";
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        }
      } finally {
        Element.prototype.getBoundingClientRect = originalRect;
        Element.prototype.getClientRects = originalRects;
        Range.prototype.getClientRects = originalRange;
        window.getComputedStyle = originalStyle;
      }
      return { rect, style };
    });
    expect(reads.rect).toBeLessThanOrEqual(90);
    expect(reads.style).toBeLessThanOrEqual(2200);
    await expect(page.locator('#react [data-part="root"]')).toHaveAttribute(
      "data-clamped",
      "true",
    );
  });
}

for (const sample of [
  {
    name: "RTL Arabic",
    text: "مرحبا بالعالم هذه فقرة طويلة لاختبار التفاف النص والحروف العربية ".repeat(
      10,
    ),
    css: "font:18px/28px serif;direction:rtl",
    location: "middle" as const,
  },
  {
    name: "CJK spacing",
    text: "中文排版与组合字符é以及家庭👨‍👩‍👧‍👦 mixed words ".repeat(10),
    css: "font:17px/27px sans-serif;letter-spacing:1.25px;word-spacing:2px",
  },
  {
    name: "monospace words",
    text: "verylongunbrokenfilename_with_combining_é_and_suffix.txt followed by other words ".repeat(
      8,
    ),
    css: "font:16px/25px monospace",
    boundary: "word" as const,
  },
]) {
  test(`layout reference ${sample.name}`, async ({ page }) => {
    await page.goto("/tests/browser/parity.html");
    await page.waitForFunction(() => !!window.mountParity);
    await page.evaluate(
      ({ css, name, ...sample }) =>
        window.mountParity({ ...sample, maxLines: 3, ellipsis: "..." }),
      sample,
    );
    await page
      .locator("#react,#vue")
      .evaluateAll(
        (els, css) =>
          els.forEach(
            (el) => ((el as HTMLElement).style.cssText = "width:240px;" + css),
          ),
        sample.css,
      );
    const shown = (id: string) =>
      page
        .locator(`#${id} [data-part="body"]`)
        .first()
        .evaluate(
          (el) => (el.querySelector('[aria-hidden="true"]') ?? el).textContent,
        );
    for (const width of [240, 400, 180]) {
      await page
        .locator("#react,#vue")
        .evaluateAll(
          (els, width) =>
            els.forEach(
              (el) => ((el as HTMLElement).style.width = width + "px"),
            ),
          width,
        );
      await expect
        .poll(async () => (await shown("react")) === (await shown("vue")))
        .toBe(true);
    }
  });
}

test("percentage height expands when the containing block grows", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  await page.evaluate(() =>
    window.mountParity({
      text: "Words and more words for height clipping. ".repeat(30),
      maxHeight: "50%",
      ellipsis: "...",
    }),
  );
  const shown = (id: string) =>
    page
      .locator(`#${id} [data-part="body"]`)
      .first()
      .evaluate(
        (el) =>
          (el.querySelector('[aria-hidden="true"]') ?? el).textContent ?? "",
      );
  let previousLength = 0;
  for (const height of [96, 240, 96]) {
    await page
      .locator("#react,#vue")
      .evaluateAll(
        (els, height) =>
          els.forEach(
            (el) => ((el as HTMLElement).style.height = height + "px"),
          ),
        height,
      );
    if (height === 240)
      await expect
        .poll(async () => (await shown("react")).length)
        .toBeGreaterThan(previousLength);
    // Upstream 1.7.1 remains stale on height-only growth; retain its initial
    // output as the shrink target, without duplicating that upstream bug.
    if (height === 96)
      await expect
        .poll(async () => (await shown("react")) === (await shown("vue")))
        .toBe(true);
    await expect
      .poll(() =>
        page
          .locator('#react [data-part="root"]')
          .evaluate((el) => el.getBoundingClientRect().height),
      )
      .toBe(height / 2);
    previousLength = (await shown("react")).length;
  }
});
