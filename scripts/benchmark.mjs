import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch();
const results = [];
try {
  for (const scenario of [
    { name: "measured-text", kind: "line", maxLines: 2, ellipsis: "..." },
    {
      name: "predictive-text",
      predictive: true,
      kind: "line",
      maxLines: 2,
      boundary: "word",
    },
    {
      name: "rich-text",
      kind: "rich",
      maxLines: 2,
      ellipsis: "...",
      html: "<strong>Formatted words</strong> with <em>inline markup</em>. ".repeat(
        100,
      ),
    },
    {
      name: "data-items",
      kind: "wrap",
      maxLines: 2,
      count: 1000,
      affixes: true,
    },
  ]) {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:4173/tests/browser/parity.html");
    await page.waitForFunction(() => !!window.mountParity);
    await page.evaluate((value) => window.mountParity(value), {
      text: "The quick brown fox jumps over the lazy dog. ".repeat(100),
      ...scenario,
    });
    await page.waitForTimeout(100);
    const samples = await page.evaluate(async () => {
      const counts = {
        react: { rect: 0, style: 0 },
        vue: { rect: 0, style: 0 },
      };
      const owner = (el) =>
        el.closest?.("#react") ? "react" : el.closest?.("#vue") ? "vue" : null;
      const originalRect = Element.prototype.getBoundingClientRect;
      const originalRects = Element.prototype.getClientRects;
      const originalRange = Range.prototype.getClientRects;
      const originalStyle = window.getComputedStyle;
      Element.prototype.getBoundingClientRect = function () {
        const id = owner(this);
        if (id) counts[id].rect++;
        return originalRect.call(this);
      };
      Element.prototype.getClientRects = function () {
        const id = owner(this);
        if (id) counts[id].rect++;
        return originalRects.call(this);
      };
      Range.prototype.getClientRects = function () {
        const n = this.commonAncestorContainer;
        const id = owner(n.nodeType === 1 ? n : n.parentElement);
        if (id) counts[id].rect++;
        return originalRange.call(this);
      };
      window.getComputedStyle = function (el, pseudo) {
        const id = owner(el);
        if (id) counts[id].style++;
        return originalStyle.call(this, el, pseudo);
      };
      try {
        for (const width of [
          250, 260, 270, 280, 290, 300, 290, 280, 270, 260,
        ]) {
          for (const id of ["react", "vue"])
            document.getElementById(id).style.width = width + "px";
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        }
      } finally {
        Element.prototype.getBoundingClientRect = originalRect;
        Element.prototype.getClientRects = originalRects;
        Range.prototype.getClientRects = originalRange;
        window.getComputedStyle = originalStyle;
      }
      return {
        counts,
        mountedItems: Object.fromEntries(
          ["react", "vue"].map((id) => [
            id,
            document.querySelectorAll("#" + id + ' [data-part="item"]').length,
          ]),
        ),
      };
    });
    results.push({ scenario: scenario.name, ...samples });
    await page.close();
  }
  const report = {
    upstream: "vue-clamp@1.7.1",
    adaptedSourceCommit: "9f93dbcc31f60b02dc34fbd6a9da9bf90edc6d84",
    browser: browser.version(),
    node: process.version,
    platform: process.platform,
    method:
      "One instance per framework; 10 width changes, two animation frames each. Counts geometry-method and getComputedStyle calls, not every CSSOM getter or execution time.",
    results,
  };
  await writeFile(
    "docs/benchmark.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
