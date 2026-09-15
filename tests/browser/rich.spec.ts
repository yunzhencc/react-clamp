import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { RichLineClamp } from "../../dist/index.js";
import { test, expect } from "@playwright/test";
// Exclude the inert measurement probe; HTML equality still checks the complete live body.
const html =
  "<strong>Hello 👨‍👩‍👧‍👦</strong> <em>formatted words and links</em> ".repeat(20);
test("rich keeps formatting while clamping measured content and matches upstream", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  await page.evaluate(
    (html) =>
      window.mountParity({
        kind: "rich",
        html,
        maxLines: 2,
        ellipsis: "...",
        affixes: true,
      }),
    html,
  );
  const body = page.locator('#react [data-part="body"]:not([inert] *)');
  await expect(body.locator("strong").first()).toBeVisible();
  await expect(body).toContainText("...");
  await expect
    .poll(
      async () =>
        (await body.innerHTML()) ===
        (await page.locator('#vue [data-part="body"]:not([inert] *)').first().innerHTML()),
    )
    .toBe(true);
});
test("rich falls back to original unsupported content without cloning active elements", async ({
  page,
}) => {
  await page.goto("/tests/browser/parity.html");
  await page.waitForFunction(() => !!window.mountParity);
  const html = '<span id="unique">' + "Words ".repeat(40) + "</span>";
  await page.evaluate(
    (html) =>
      window.mountParity({ kind: "rich", html, maxLines: 1, ellipsis: "..." }),
    html,
  );
  await expect(page.locator('#react [data-part="body"]:not([inert] *)')).toHaveJSProperty(
    "innerHTML",
    html,
  );
  await expect(page.locator("#react #unique")).toHaveCount(1);
});

for (const value of [
  { html, maxLines: 2 },
  {
    html,
    maxLines: 2,
    boundary: "word" as const,
    ellipsis: "...",
    affixes: true,
  },
  {
    html: "before <br><em>after a forced break </em>".repeat(12),
    maxLines: 2,
    ellipsis: "...",
  },
  {
    html: '<svg width="20" height="20"><circle cx="10" cy="10" r="8" /></svg> <b>Icons and words </b>'.repeat(
      10,
    ),
    maxHeight: "3em",
    ellipsis: "...",
  },
  {
    html: "<div>Unsupported block " + "word ".repeat(20) + "</div>",
    maxLines: 1,
    ellipsis: "...",
  },
]) {
  test(`rich reference ${JSON.stringify(value).slice(-100)}`, async ({
    page,
  }) => {
    await page.goto("/tests/browser/parity.html");
    await page.waitForFunction(() => !!window.mountParity);
    await page.evaluate(
      (value) => window.mountParity({ kind: "rich", ...value }),
      value,
    );
    const a = page.locator('#react [data-part="body"]:not([inert] *)');
    const b = page.locator('#vue [data-part="body"]:not([inert] *)').first();
    await expect(a).toBeVisible();
    await expect
      .poll(async () => (await a.innerHTML()) === (await b.innerHTML()))
      .toBe(true);
    await page.locator("#react,#vue").evaluateAll((elements) => {
      for (const el of elements) (el as HTMLElement).style.width = "400px";
    });
    await expect
      .poll(async () => (await a.innerHTML()) === (await b.innerHTML()))
      .toBe(true);
  });
}

test("rich hydrates server HTML without hydration mismatches", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const markup = renderToString(
    createElement(RichLineClamp, { html, maxLines: 2, ellipsis: "..." }),
  );
  await page.addInitScript((html) => {
    window.hydrationKind = "rich";
    window.hydrationText = html;
  }, html);
  await page.route("**/rich-hydrate", (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        '<!doctype html><meta charset="UTF-8"><div id="root" style="width:240px;font:16px/24px Arial">' +
        markup +
        '</div><script type="module" src="/tests/browser/hydration.tsx"></script>',
    }),
  );
  await page.goto("/rich-hydrate");
  await expect(page.locator('[data-part="body"]:not([inert] *)')).toContainText("...");
  expect(await page.evaluate(() => window.hydrationErrors)).toEqual([]);
  expect(errors).toEqual([]);
});
